import os
import time
import json
import base64
import smtplib
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from datetime import datetime

# In-memory OTP storage
# Format: { 'email@example.com': { 'code': '123456', 'expiresAt': 1234567890 } }
otp_store: Dict[str, Dict[str, Any]] = {}

def get_access_token() -> str:
    """Uses the Google Refresh Token to fetch a fresh Access Token"""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN")

    if not client_id or not client_secret or not refresh_token:
        raise ValueError("Missing Google OAuth environment variables.")

    url = "https://oauth2.googleapis.com/token"
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            return res_data["access_token"]
    except Exception as e:
        print(f"Error fetching access token: {e}")
        raise

def send_email(to_email: str, subject: str, text_content: str, html_content: str, from_name: str = "ConveyorGuard"):
    """Sends an email using Gmail SMTP and XOAUTH2"""
    sender_email = os.environ.get("SENDER_EMAIL")
    if not sender_email:
        raise ValueError("Missing SENDER_EMAIL environment variable.")

    access_token = get_access_token()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{sender_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    auth_string = f"user={sender_email}\1auth=Bearer {access_token}\1\1"

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.ehlo()
        server.starttls()
        server.docmd("AUTH", "XOAUTH2 " + base64.b64encode(auth_string.encode()).decode("utf-8"))
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        raise

def send_otp_email(email: str) -> str:
    import random
    code = str(random.randint(100000, 999999))
    otp_store[email] = {
        "code": code,
        "expiresAt": time.time() + (10 * 60) # 10 minutes
    }
    
    html = f"""
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 2px;">CONVEYOR GUARD AI</h2>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff; text-align: center;">
          <h3 style="margin-top: 0; color: #334155; font-size: 20px;">Secure Login Verification</h3>
          <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
            Please use the following 6-digit verification code to complete your login. This code will expire in 10 minutes.
          </p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; margin: 0 auto; display: inline-block;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0ea5e9;">{code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; {datetime.now().year} ConveyorGuard AI. All rights reserved.
        </div>
      </div>
    """
    
    send_email(
        to_email=email,
        subject="Your ConveyorGuard Login Code",
        text_content=f"Your 6-digit login code is: {code}. It expires in 10 minutes.",
        html_content=html,
        from_name="ConveyorGuard Security"
    )
    return code

def verify_otp(email: str, code: str) -> bool:
    record = otp_store.get(email)
    if not record:
        return False
    if time.time() > record["expiresAt"]:
        del otp_store[email]
        return False
    if record["code"] == code:
        del otp_store[email]
        return True
    return False

def send_critical_alert(email: str, defect_details: dict):
    details_json = json.dumps(defect_details, indent=2)
    html = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.2);">
      <div style="background-color: #ef4444; color: white; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 2px;">🚨 CRITICAL ANOMALY DETECTED</h2>
      </div>
      <div style="padding: 40px 30px; background-color: #ffffff;">
        <h3 style="margin-top: 0; color: #7f1d1d; font-size: 20px;">Immediate Action Required</h3>
        <p style="color: #64748b; font-size: 15px; line-height: 1.6;">
          ConveyorGuard AI has detected a critical anomaly that requires immediate inspection.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <pre style="margin: 0; color: #991b1b; font-family: monospace; font-size: 13px; white-space: pre-wrap;">{details_json}</pre>
        </div>
        <a href="https://conveyorguardai.onrender.com" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Open Live Monitor</a>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        This is an automated security alert from ConveyorGuard AI.
      </div>
    </div>
    """
    
    send_email(
        to_email=email,
        subject="🚨 CRITICAL: Conveyor Anomaly Detected",
        text_content=f"A critical anomaly was detected on the conveyor belt.\nDetails:\n{details_json}",
        html_content=html,
        from_name="ConveyorGuard Alerts"
    )

def send_work_order(email: str, work_order: dict):
    joint_id = work_order.get('jointId', '')
    priority = work_order.get('priority', '')
    issue = work_order.get('issue', '')
    technician = work_order.get('technician', '')
    scheduled_at = work_order.get('scheduledAt', '')
    notes = work_order.get('notes', '')

    priority_bg = '#fee2e2' if priority == 'CRITICAL' else '#ffedd5' if priority == 'HIGH' else '#e0f2fe'
    priority_color = '#991b1b' if priority == 'CRITICAL' else '#9a3412' if priority == 'HIGH' else '#075985'

    notes_html = ""
    if notes:
        notes_html = f"""
        <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">AI Notes & Recommendations</h4>
          <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">{notes}</p>
        </div>
        """

    html = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #3b82f6; color: white; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 2px;">🔧 WORK ORDER CREATED</h2>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Maintenance Task Dispatched</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px; width: 35%;"><strong>Joint ID</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 600;">{joint_id}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; color: #64748b; font-size: 14px;"><strong>Priority</strong></td>
            <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: 600;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: {priority_bg}; color: {priority_color};">{priority}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px;"><strong>Issue</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px;">{issue}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; color: #64748b; font-size: 14px;"><strong>Assigned To</strong></td>
            <td style="padding: 10px; color: #0f172a; font-size: 14px;">{technician}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px;"><strong>Scheduled Time</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px;">{scheduled_at}</td>
          </tr>
        </table>

        {notes_html}
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        &copy; {datetime.now().year} ConveyorGuard AI Maintenance Dispatch.
      </div>
    </div>
    """

    send_email(
        to_email=email,
        subject=f"🔧 Work Order Dispatched: {joint_id} [{priority}]",
        text_content=f"A new work order was created for {joint_id}.\nIssue: {issue}\nTechnician: {technician}\nScheduled: {scheduled_at}",
        html_content=html,
        from_name="ConveyorGuard Maintenance"
    )
