import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuration - Use environment variables in a real app!
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "yipintan323@gmail.com"
SENDER_PASSWORD = "nihc vupb alsf hjve" # Not your login password!

def send_dispatch_notification(tech_email, tech_name, ticket_list):
    """
    Sends an automated dispatch email to a technician.
    ticket_list: List of Ticket IDs assigned to them.
    """
    if not tech_email:
        print(f"⚠️ No email found for {tech_name}. Skipping...")
        return False

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"MO-SAHH Dispatch <{SENDER_EMAIL}>"
        msg['To'] = tech_email
        msg['Subject'] = f"🚨 NEW TASK ALLOCATION: {len(ticket_list)} Tickets Assigned"

        # Create body
        body = f"""
        Hello {tech_name},

        The MO-SAHH Engine has completed a rescheduling cycle. 
        You have been assigned the following tickets:
        
        Tickets: {', '.join(map(str, ticket_list))}

        Please log in to the Technician Portal to view your optimized route.
        
        System Timestamp: {tech_email}
        """
        msg.attach(MIMEText(body, 'plain'))

        # Connect and Send
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls() # Secure the connection
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"📧 Notification sent successfully to {tech_name}")
        return True
    except Exception as e:
        print(f"❌ SMTP Error: {str(e)}")
        return False