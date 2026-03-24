"""
Customer Invite Email Template
apps/customers/email_templates.py
"""


def get_customer_invite_email(
    full_name: str,
    company_name: str,
    invite_url: str,
    phone_number: str,
) -> tuple[str, str]:
    """
    Returns (subject, html_content) for a customer invite email.

    Args:
        full_name:    Customer's full name
        company_name: The distributor's company name
        invite_url:   The unique invite link (frontend URL with token)
        phone_number: Customer's phone number (shown so they know what to use)
    """
    subject = f"You're invited to order water from {company_name}"

    first_name = full_name.split()[0] if full_name else "there"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Water Delivery Account is Ready</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0c1e35 0%,#0f3460 60%,#0a4a7c 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
            <!-- Logo -->
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

            <!-- Drop icon -->
            <div style="width:72px;height:72px;background:rgba(56,189,248,0.15);border:1.5px solid rgba(56,189,248,0.35);border-radius:50%;margin:0 auto 20px;text-align:center;line-height:72px;">
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                <path d="M14 3C14 3 5 12.5 5 18C5 22.4 9.1 26 14 26C18.9 26 23 22.4 23 18C23 12.5 14 3 14 3Z" fill="#38bdf8"/>
                <ellipse cx="10.5" cy="17" rx="2" ry="3" fill="white" opacity="0.35" transform="rotate(-20 10.5 17)"/>
              </svg>
            </div>

            <h1 style="margin:0 0 8px;font-family:'Georgia',serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Fresh water, delivered.</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);font-style:italic;">{company_name} has set up your account</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
              Hi <strong style="color:#0f3460;">{first_name}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
              <strong style="color:#374151;">{company_name}</strong> has created a water delivery account for you.
              Tap the button below to set up your account — it only takes a minute.
            </p>

            <!-- Phone reminder -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #93c5fd;border-radius:10px;padding:16px 18px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:12px;vertical-align:middle;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#2563eb" opacity="0.8"/>
                        </svg>
                      </td>
                      <td>
                        <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:1px;color:#1e40af;text-transform:uppercase;">Your login phone number</p>
                        <p style="margin:0;font-size:16px;font-weight:700;color:#1e3a8a;letter-spacing:1px;">{phone_number}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- How it works -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f8fafc;border-radius:12px;padding:24px;">
                  <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#6b7280;text-transform:uppercase;">How it works</p>
                  <!-- Step 1 -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td style="width:32px;vertical-align:top;padding-top:1px;">
                        <div style="width:24px;height:24px;background:#0f3460;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#fff;display:inline-block;">1</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">Tap <strong>Complete My Account</strong> below</p>
                      </td>
                    </tr>
                  </table>
                  <!-- Step 2 -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td style="width:32px;vertical-align:top;padding-top:1px;">
                        <div style="width:24px;height:24px;background:#0f3460;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#fff;display:inline-block;">2</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">Verify your phone number <strong>{phone_number}</strong> with an OTP</p>
                      </td>
                    </tr>
                  </table>
                  <!-- Step 3 -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;padding-top:1px;">
                        <div style="width:24px;height:24px;background:#0f3460;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#fff;display:inline-block;">3</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">Start ordering water — anytime!</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="{invite_url}"
                     style="display:inline-block;background:linear-gradient(135deg,#0f3460,#0a4a7c);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:18px 52px;border-radius:12px;letter-spacing:0.3px;font-family:'Georgia',serif;">
                    Complete My Account →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Link fallback -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Or copy this link</p>
                  <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;font-family:'Courier New',monospace;">{invite_url}</p>
                </td>
              </tr>
            </table>

            <!-- Expiry warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:10px;vertical-align:top;padding-top:2px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 9v4M12 17h.01M12 2L2 20h20L12 2z" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </td>
                      <td>
                        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                          This invite link expires in <strong>7 days</strong>. If it expires, ask {company_name} to resend your invite.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td style="border-top:1px solid #f3f4f6;"></td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">Questions? Contact your distributor:</p>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#374151;">{company_name}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
              Powered by <strong style="color:#6b7280;">AquaTrack</strong> · Water Distribution Management
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
