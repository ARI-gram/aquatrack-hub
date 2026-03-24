# AquaTrack Backend

Django REST API for AquaTrack - Water Bottle Distribution SaaS

## Setup Instructions

### 1. Install Python
Make sure you have Python 3.10+ installed

### 2. Create Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Variables
Create a `.env` file (copy from `.env.example`)

### 5. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser
```bash
python manage.py createsuperuser
```

### 7. Run Development Server
```bash
python manage.py runserver
```

API will be available at: `http://localhost:8000/api/`

## Project Structure
```
backend/
├── apps/               # Django applications
│   ├── authentication/ # User auth & roles
│   ├── customers/      # Customer management
│   ├── orders/         # Order processing
│   ├── bottles/        # Bottle tracking
│   └── wallet/         # Payment system
├── core/               # Shared utilities
├── utils/              # Helper functions
└── aquatrack/          # Project settings
```

## Tech Stack

- Django 5.0
- Django REST Framework
- PostgreSQL (or SQLite for development)
- JWT Authentication
- CORS enabled for frontend

## Frontend Integration

Frontend is in the parent directory at `../src/`
Frontend dev server: `http://localhost:5173`