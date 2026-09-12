const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory OTP storage
// Format: { 'email@example.com': { code: '123456', expiresAt: 1234567890 } }
const otpStore = {};

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

async function createTransporter() {
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.SENDER_EMAIL,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
  } catch (error) {
    console.error("Error creating transporter:", error);
    throw error;
  }
}

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins
  };

  try {
    const emailTemplate = `
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
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0ea5e9;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; ${new Date().getFullYear()} ConveyorGuard AI. All rights reserved.
        </div>
      </div>
    `;

    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ConveyorGuard Security" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: 'Your ConveyorGuard Login Code',
      text: `Your 6-digit login code is: ${code}. It expires in 10 minutes.`,
      html: emailTemplate
    });
    console.log(`Sent OTP to ${email}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error("Failed to send email:", err);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const record = otpStore[email];
  if (!record) return res.status(400).json({ error: 'No OTP found or expired' });

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (record.code === code) {
    delete otpStore[email];
    return res.json({ success: true });
  } else {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }
});

app.post('/api/alerts/critical', async (req, res) => {
  const { email, defectDetails } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const emailTemplate = `
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
          <pre style="margin: 0; color: #991b1b; font-family: monospace; font-size: 13px; white-space: pre-wrap;">${JSON.stringify(defectDetails, null, 2)}</pre>
        </div>
        <a href="http://localhost:5173" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Open Live Monitor</a>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        This is an automated security alert from ConveyorGuard AI.
      </div>
    </div>
  `;

  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ConveyorGuard Alerts" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: '🚨 CRITICAL: Conveyor Anomaly Detected',
      text: `A critical anomaly was detected on the conveyor belt.\nDetails:\n${JSON.stringify(defectDetails, null, 2)}`,
      html: emailTemplate
    });
    console.log(`Sent critical alert to ${email}`);
    res.json({ success: true, message: 'Alert sent' });
  } catch (err) {
    console.error("Failed to send critical alert:", err);
    res.status(500).json({ error: 'Failed to send alert email' });
  }
});

app.post('/api/alerts/work-order', async (req, res) => {
  const { email, workOrder } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { jointId, issue, priority, technician, scheduledAt, notes } = workOrder;

  const emailTemplate = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #3b82f6; color: white; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 2px;">🔧 WORK ORDER CREATED</h2>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Maintenance Task Dispatched</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px; width: 35%;"><strong>Joint ID</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${jointId}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; color: #64748b; font-size: 14px;"><strong>Priority</strong></td>
            <td style="padding: 10px; color: #0f172a; font-size: 14px; font-weight: 600;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: ${priority === 'CRITICAL' ? '#fee2e2' : priority === 'HIGH' ? '#ffedd5' : '#e0f2fe'}; color: ${priority === 'CRITICAL' ? '#991b1b' : priority === 'HIGH' ? '#9a3412' : '#075985'};">${priority}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px;"><strong>Issue</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px;">${issue}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; color: #64748b; font-size: 14px;"><strong>Assigned To</strong></td>
            <td style="padding: 10px; color: #0f172a; font-size: 14px;">${technician}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px;"><strong>Scheduled Time</strong></td>
            <td style="padding: 10px 0; color: #0f172a; font-size: 14px;">${scheduledAt}</td>
          </tr>
        </table>

        ${notes ? `
        <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">AI Notes & Recommendations</h4>
          <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">${notes}</p>
        </div>` : ''}
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        &copy; ${new Date().getFullYear()} ConveyorGuard AI Maintenance Dispatch.
      </div>
    </div>
  `;

  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ConveyorGuard Maintenance" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: `🔧 Work Order Dispatched: ${jointId} [${priority}]`,
      text: `A new work order was created for ${jointId}.\nIssue: ${issue}\nTechnician: ${technician}\nScheduled: ${scheduledAt}`,
      html: emailTemplate
    });
    console.log(`Sent work order email to ${email}`);
    res.json({ success: true, message: 'Work order email sent' });
  } catch (err) {
    console.error("Failed to send work order email:", err);
    res.status(500).json({ error: 'Failed to send work order email' });
  }
});

app.listen(PORT, () => {
  console.log(`Node Mailer Service running on port ${PORT}`);
});
