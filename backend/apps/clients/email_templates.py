"""
Email Templates
apps/clients/email_templates.py
"""


def get_password_reset_email(first_name: str, email: str, temp_password: str, frontend_url: str) -> tuple[str, str]:
    """
    Returns (subject, html_content) for a password reset email.
    """
    subject = "AquaTrack – Your Password Has Been Reset"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AquaTrack – Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0c1e35 0%,#0f3460 60%,#0a4a7c 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:14px 20px;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-right:10px;vertical-align:middle;">
                              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 3C14 3 5 12.5 5 18C5 22.4 9.1 26 14 26C18.9 26 23 22.4 23 18C23 12.5 14 3 14 3Z" fill="#38bdf8" opacity="0.9"/>
                                <ellipse cx="10.5" cy="17" rx="2" ry="3" fill="white" opacity="0.25" transform="rotate(-20 10.5 17)"/>
                              </svg>
                            </td>
                            <td style="vertical-align:middle;">
                              <span style="font-family:'Georgia',serif;font-size:20px;font-weight:700;color:#ffffff;">Aqua<span style="color:#38bdf8;">Track</span></span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <div style="width:64px;height:64px;background:rgba(56,189,248,0.15);border:1.5px solid rgba(56,189,248,0.35);border-radius:50%;margin:0 auto 20px;display:inline-block;text-align:center;line-height:64px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-top:18px;">
                <path d="M12 2C10.343 2 9 3.343 9 5v4H5a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V10a1 1 0 00-1-1h-4V5c0-1.657-1.343-3-3-3zm0 2c.552 0 1 .448 1 1v4h-2V5c0-.552.448-1 1-1zm0 9a2 2 0 110 4 2 2 0 010-4z" fill="#38bdf8"/>
              </svg>
            </div>

            <h1 style="margin:0 0 8px;font-family:'Georgia',serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Password Reset</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);font-style:italic;">Your account credentials have been updated</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
              Dear <strong style="color:#0f3460;">{first_name}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.7;">
              An administrator has reset your <strong style="color:#374151;">AquaTrack</strong> account password.
              Below are your new temporary login credentials. Please keep them secure.
            </p>

            <!-- Credentials Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#f8faff 0%,#eff6ff 100%);border:1.5px solid #bfdbfe;border-radius:12px;padding:28px 28px 24px;">
                  <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#6b7280;text-transform:uppercase;">Login Credentials</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                    <tr>
                      <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
                        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Email Address</p>
                        <p style="margin:0;font-size:15px;color:#0f3460;font-weight:600;">{email}</p>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:14px 16px;background:#0f3460;border-radius:8px;">
                        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Temporary Password</p>
                        <p style="margin:0;font-size:18px;color:#38bdf8;font-family:'Courier New',monospace;font-weight:700;letter-spacing:3px;">{temp_password}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:16px 18px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:12px;vertical-align:top;padding-top:2px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L2 20h20L12 2z" fill="#f59e0b" opacity="0.2"/>
                          <path d="M12 9v4M12 17h.01" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
                          <path d="M12 2L2 20h20L12 2z" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                      </td>
                      <td>
                        <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#92400e;">Security Notice</p>
                        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                          You will be prompted to <strong>change this password</strong> immediately after logging in.
                          If you did not request this reset, contact support at once.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
              <tr>
                <td align="center">
                  <a href="{frontend_url}/login" style="display:inline-block;background:linear-gradient(135deg,#0f3460,#0a4a7c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 48px;border-radius:10px;letter-spacing:0.3px;font-family:'Georgia',serif;">
                    Log In to AquaTrack →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td style="border-top:1px solid #f3f4f6;"></td></tr>
            </table>

            <!-- Support -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Need Help?</p>
                  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">
                    <a href="mailto:support@aquatrack.co.ke" style="color:#0f3460;text-decoration:none;font-weight:600;">support@aquatrack.co.ke</a>
                  </p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">+254 XXX XXX XXX</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
              This email was sent by <strong style="color:#6b7280;">AquaTrack</strong> · Water Distribution Management
            </p>
            <p style="margin:0;font-size:12px;color:#d1d5db;">© 2026 AquaTrack. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    return subject, html


def get_welcome_email(first_name: str, email: str, temp_password: str, frontend_url: str, plan_info: str, expires_text: str) -> tuple[str, str]:
    """
    Returns (subject, html_content) for a new client welcome email.
    """
    subject = "Welcome to AquaTrack – Your Account Is Ready"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to AquaTrack</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0c1e35 0%,#0f3460 60%,#0a4a7c 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:14px 20px;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-right:10px;vertical-align:middle;">
                              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 3C14 3 5 12.5 5 18C5 22.4 9.1 26 14 26C18.9 26 23 22.4 23 18C23 12.5 14 3 14 3Z" fill="#38bdf8" opacity="0.9"/>
                                <ellipse cx="10.5" cy="17" rx="2" ry="3" fill="white" opacity="0.25" transform="rotate(-20 10.5 17)"/>
                              </svg>
                            </td>
                            <td style="vertical-align:middle;">
                              <span style="font-family:'Georgia',serif;font-size:20px;font-weight:700;color:#ffffff;">Aqua<span style="color:#38bdf8;">Track</span></span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <div style="width:64px;height:64px;background:rgba(56,189,248,0.15);border:1.5px solid rgba(56,189,248,0.35);border-radius:50%;margin:0 auto 20px;display:inline-block;text-align:center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-top:18px;">
                <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <h1 style="margin:0 0 8px;font-family:'Georgia',serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Welcome to AquaTrack!</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);font-style:italic;">Your distributor account is ready to go</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
              Dear <strong style="color:#0f3460;">{first_name}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.7;">
              Your <strong style="color:#374151;">AquaTrack</strong> company account has been successfully created.
              Use the credentials below to log in and get started.
            </p>

            <!-- Plan Badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1.5px solid #6ee7b7;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:1px;color:#065f46;text-transform:uppercase;">Your Plan</p>
                        <p style="margin:0;font-size:15px;font-weight:700;color:#064e3b;">{plan_info} &nbsp;·&nbsp; <span style="font-weight:400;font-size:13px;color:#047857;">{expires_text}</span></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Credentials Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#f8faff 0%,#eff6ff 100%);border:1.5px solid #bfdbfe;border-radius:12px;padding:28px 28px 24px;">
                  <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#6b7280;text-transform:uppercase;">Login Credentials</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                    <tr>
                      <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
                        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Email Address</p>
                        <p style="margin:0;font-size:15px;color:#0f3460;font-weight:600;">{email}</p>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:14px 16px;background:#0f3460;border-radius:8px;">
                        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Temporary Password</p>
                        <p style="margin:0;font-size:18px;color:#38bdf8;font-family:'Courier New',monospace;font-weight:700;letter-spacing:3px;">{temp_password}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Features -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:20px 22px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">What's Included</p>
                  {''.join([f'<p style="margin:0 0 8px;font-size:13px;color:#374151;">✓ &nbsp;{f}</p>' for f in [
        'Cloud database management &amp; automated backups',
        'Real-time delivery tracking with GPS',
        'Customer portal &amp; order management',
        'Inventory &amp; bottle management',
        'Automated invoicing (M-Pesa &amp; bank transfers)',
        'Advanced analytics &amp; reporting',
    ]])}
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:16px 18px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:12px;vertical-align:top;padding-top:2px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L2 20h20L12 2z" fill="#f59e0b" opacity="0.2"/>
                          <path d="M12 9v4M12 17h.01" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
                          <path d="M12 2L2 20h20L12 2z" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                      </td>
                      <td>
                        <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#92400e;">First Login</p>
                        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                          You will be prompted to <strong>set a permanent password</strong> the first time you log in.
                          Keep these credentials safe until then.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
              <tr>
                <td align="center">
                  <a href="{frontend_url}/login" style="display:inline-block;background:linear-gradient(135deg,#0f3460,#0a4a7c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 48px;border-radius:10px;letter-spacing:0.3px;font-family:'Georgia',serif;">
                    Get Started →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td style="border-top:1px solid #f3f4f6;"></td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Need Help?</p>
                  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">
                    <a href="mailto:support@aquatrack.co.ke" style="color:#0f3460;text-decoration:none;font-weight:600;">support@aquatrack.co.ke</a>
                  </p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">+254 XXX XXX XXX</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
              This email was sent by <strong style="color:#6b7280;">AquaTrack</strong> · Water Distribution Management
            </p>
            <p style="margin:0;font-size:12px;color:#d1d5db;">© 2026 AquaTrack. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    return subject, html
