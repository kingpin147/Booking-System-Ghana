import { Permissions, webMethod } from 'wix-web-module';
import wixPayBackend from 'wix-pay-backend';

// Create a payment using dynamic product info passed from the frontend
export const createMyPayment = webMethod(Permissions.Anyone, (paymentData) => {
    // Extract details from the object passed from the frontend
    
   // Create the payment with the provided details
    return wixPayBackend.createPayment({
        items: [
            {
                name: paymentData.name,
                price: paymentData.price,
            },
        ],
        amount: paymentData.price,
        currency: "GBP", // Set to GBP for British Pounds
    });
});

import wixPricingPlansBackend from "wix-pricing-plans-backend";

export const myCreatePlanFunction = webMethod(
  Permissions.Anyone,
  (planInfo) => {
    return wixPricingPlansBackend.createPlan(planInfo);
  }
);


import { triggeredEmails } from "wix-crm-backend";

export const sendCustomEmail = webMethod(
  Permissions.Anyone,
  async (emailId, contactId, variables) => {
    try {
      // Validate inputs
      if (!emailId || !contactId || !variables) {
        throw new Error("Missing required parameters: emailId, contactId, or variables.");
      }

      // Send the triggered email
      await triggeredEmails.emailContact(emailId, contactId, { variables });

      console.log("Email successfully sent to contact:", contactId);
      return { success: true, message: "Email sent successfully." };
    } catch (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }
  }
);


import { contacts } from "wix-crm-backend";

export const myCreateContactFunction = webMethod(Permissions.Anyone, async(name, email) => {
  const contactInfo = {
    name: {
      first: name,
    },
    emails: [
      {
        tag: "WORK",
        email: email,
      },
    ],
  };

  const options = {
    allowDuplicates: true,
    suppressAuth: true,
  };

  return contacts
    .createContact(contactInfo, options)
    .then((contact) => {
      return contact._id;
    })
    .catch((error) => {
      console.error(error);
    });
});


