const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'motosmaxcordialidad@gmail.com', pass: 'xqqb kelv repu ybjk' },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

transporter.sendMail({
  from: '"Motos Max Cordialidad" <motosmaxcordialidad@gmail.com>',
  to: 'motosmaxcordialidad@gmail.com',
  subject: 'Test desde Node',
  html: '<p>Test de envio SMTP</p>',
}).then((info) => {
  console.log('ENVIADO:', info.messageId, info.response);
}).catch((err) => {
  console.log('ERROR:', err.message, err.code);
}).finally(() => transporter.close());
