import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

# Configuration - Use environment variables in a real app!
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "yipintan323@gmail.com"
SENDER_PASSWORD = "nihc vupb alsf hjve" # Not your login password!

def send_email(tech_email, subject, body):
    if not tech_email:
        print("⚠️ No recipient email found. Skipping...")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Auto-Scheduler Notification <{SENDER_EMAIL}>"
        msg["To"] = tech_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()

        print(f"📧 Email sent successfully to {tech_email}")
        return True

    except Exception as e:
        print(f"❌ SMTP Error: {str(e)}")
        return False


def send_dispatch_notification(tech_email, tech_name, ticket_list):
    """
    Normal task assignment email.
    Used when MO-SAHH assigns tickets.
    """
    subject = f"🚨 NEW TASK ALLOCATION: {len(ticket_list)} Tickets Assigned"

    body = f"""
Hello {tech_name},

The MO-SAHH Engine has completed a scheduling cycle.

You have been assigned the following ticket(s):

Tickets: {', '.join(map(str, ticket_list))}

Please log in to the Technician Portal to view your assigned tasks.

System Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    return send_email(tech_email, subject, body)


def send_pending_escalation_notification(tech_email, tech_name, ticket_id, elapsed_minutes):
    """
    Rule-based pending escalation email.
    Used when ticket remains pending for 15 minutes.
    """
    subject = f"⚠️ PENDING ESCALATION: Ticket #{ticket_id} Not Yet Attended"

    body = f"""
Hello {tech_name},

This is an automated rule-based escalation alert.

Ticket #{ticket_id} has remained in PENDING status for approximately {int(elapsed_minutes)} minutes after assignment.

Please attend to this ticket as soon as possible.

Rule Triggered:
- Condition: Pending ticket not acknowledged
- Threshold: 15 minutes

System Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    return send_email(tech_email, subject, body)


def send_closure_reminder_notification(tech_email, tech_name, ticket_id, elapsed_minutes):
    """
    Rule-based closure reminder email.
    Used when ticket remains attending for 1 hour.
    """
    subject = f"🔔 CLOSURE REMINDER: Ticket #{ticket_id} Still Attending"

    body = f"""
Hello {tech_name},

This is an automated rule-based closure reminder.

Ticket #{ticket_id} has remained in ATTENDING status for approximately {int(elapsed_minutes)} minutes.

If the maintenance work has been completed, please update or close the ticket in the system.

Rule Triggered:
- Condition: Ticket still in attending status
- Threshold: 60 minutes

System Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    return send_email(tech_email, subject, body)