"""
User Authentication Models
Handles all user types with role-based access control
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid


class UserRole(models.TextChoices):
    """User role choices for role-based access control"""
    SUPER_ADMIN = 'super_admin', 'Super Admin'
    CLIENT_ADMIN = 'client_admin', 'Client Admin'
    SITE_MANAGER = 'site_manager', 'Site Manager'
    DRIVER = 'driver', 'Driver'
    CUSTOMER = 'customer', 'Customer'


class UserManager(BaseUserManager):
    """Custom user manager for User model"""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user"""
        if not email:
            raise ValueError('Users must have an email address')

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.SUPER_ADMIN)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User Model
    Supports all user types: Super Admin, Client Admin, Site Manager, Driver, Customer
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Authentication fields
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="User's email address (used for login)"
    )

    # Contact information
    phone = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text="User's phone number"
    )

    # Driver-specific field
    vehicle_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Vehicle registration number (drivers only)"
    )

    # Personal information
    first_name = models.CharField(
        max_length=100,
        help_text="User's first name"
    )
    last_name = models.CharField(
        max_length=100,
        help_text="User's last name"
    )

    # Role and permissions
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        help_text="User's role in the system"
    )

    # Multi-tenancy: Link to distributor/client
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='users',
        help_text="The distributor this user belongs to (null for super admins)"
    )

    # Profile
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        help_text="User's profile picture"
    )

    # Status flags
    is_active = models.BooleanField(
        default=True,
        help_text="User can login and use the system"
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="User can access Django admin"
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="Email has been verified"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # Manager
    objects = UserManager()

    # Settings for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'role']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['client', 'role']),
        ]

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    @property
    def full_name(self):
        """Return user's full name"""
        return f"{self.first_name} {self.last_name}".strip()

    def has_perm(self, perm, obj=None):
        """Does the user have a specific permission?"""
        return self.is_superuser or self.is_staff

    def has_module_perms(self, app_label):
        """Does the user have permissions to view the app `app_label`?"""
        return self.is_superuser or self.is_staff


class RefreshToken(models.Model):
    """
    Store refresh tokens for JWT authentication
    Allows tracking and revoking tokens
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='refresh_tokens'
    )

    token = models.CharField(
        max_length=500,
        unique=True,
        db_index=True
    )

    expires_at = models.DateTimeField()

    is_revoked = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'refresh_tokens'
        ordering = ['-created_at']
        verbose_name = 'Refresh Token'
        verbose_name_plural = 'Refresh Tokens'

    def __str__(self):
        return f"Token for {self.user.email} (expires: {self.expires_at})"

    @property
    def is_expired(self):
        """Check if token has expired"""
        return timezone.now() > self.expires_at

    def revoke(self):
        """Revoke this token"""
        self.is_revoked = True
        self.save()
