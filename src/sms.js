// this handles character phone numbers

function ReceiveSMS(state, req, res)
{
  const twilioSignature = req.headers['x-twilio-signature'];
  const params = req.body;
  const url = 'https://lysle.net:3001/sms'; // Replace with your public server URL

  if (twilio.validateRequest(process.env.TWILIO_AUTH, twilioSignature, url, params)) {
      
    let msgObj={to: state.SMS_CHARACTER, from: state.SMS_USER_NAME, message: req.body.Body};
    console.log(`[Sms] received message from twilio: to: ${msgObj.to} from: ${msgObj.from} message: ${msgObj.message} `);
    ReceiveChatObject(state, msgObj, req.body.From); // process as a chat object
  } else {
      res.status(403).send('Request not validated by Twilio');
      console.log(`[Sms] received message from twilio, failed validation`);
  }
}

module.exports = {
    ReceiveSMS: ReceiveSMS,
};
  