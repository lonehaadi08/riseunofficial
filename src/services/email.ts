import axios from 'axios';

const EMAILJS_SERVICE_ID = 'service_z7a32gh';
const EMAILJS_TEMPLATE_ID = 'template_fhqy1oh';
const EMAILJS_PUBLIC_KEY = 'eV9GmBZdy2ByqSZmw';

// Generates a random 6-digit number
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOTPEmail = async (email: string, name: string, otp: string) => {
  try {
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: email,
        to_name: name,
        otp_code: otp, // Ensure your EmailJS template contains the {{otp_code}} variable
        message: `Your verification code is: ${otp}` // Fallback if template uses {{message}}
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error("EmailJS Error:", error);
    return false;
  }
};