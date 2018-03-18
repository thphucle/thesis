const mailTemplate = require("controllers/helpers/mail-template");

const express = require('express');
const router = express.Router();


router.get('/:templateName', (req, res) => {
  try {
    console.log("REQ ", req.param.templateName);
    let templateName = req.params.templateName;
    let data = getData(templateName);
    res.set('Content-Type', 'text/html');
    return res.send(mailTemplate.toHtml(templateName, data))
    
  } catch (error) {
    res.send(error.message);
  }
});

function getData(templateName) {
  switch (templateName) {
    case 'new-user': return {user: {username: 'zenzen', password: 'zenzen@gmail.com'}, login_url: 'http://google.com'}
    case 'verify': return {user: {username: 'zenzen', password: 'zenzen@gmail.com', link: 'http://google.com'}}
    case 'active-success': return {user: {username: 'zenzen', password: 'zenzen@gmail.com', link: 'http://google.com'}}
    case 'password': return {user: {username: 'zenzen', password: 'zenzen@gmail.com', link: 'http://google.com'}}
    default: return {user: {username: 'zenzen', password: 'zenzen@gmail.com', link: 'http://google.com'}}
  }
}

module.exports = router;
