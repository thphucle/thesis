import {schemas} from "schemas";
import * as config from "libs/config";
import writeLog from '../helpers/log-helper'
import SystemLog from '../interfaces/SystemLog'
import misc from 'libs/misc';
import * as nodeMailerHtmlText from 'nodemailer-html-to-text';


const nodemailer = require('nodemailer');
const htmlToText = nodeMailerHtmlText.htmlToText;

const mails = require("../../mails.json");
const MAIL_COUNT = mails.length;
const mailTemplate = require('./mail-template');

class MailHelper {
  mailIndex = 0;

  constructor() {
  }
  public getMail() {
    let mail = mails[this.mailIndex];
    this.mailIndex ++;
    if (this.mailIndex >= MAIL_COUNT) {
      this.mailIndex = 0;
    }
    console.log(this.mailIndex, mail);
    return mail;
  }

  public async sendMail(mail, userId?:number) {
    let _chosen = this.getMail();
    let chosen = Object.assign({},_chosen);

    if (!chosen) {
      throw "Supporter mail can not be found";
    }

    var user = chosen.user;
    var pass = chosen.pass;
    var host = chosen.host;

    if (!user || !pass || !host) {
      console.log('local: not send email');
      throw "local: not send email";
    }
    var smtpConfig = {
      service: 'Zoho',
	    host: host,
	    port: chosen.port || 465,
	    secure: chosen.secure, // use SSL
	    auth: {
	        user: user,
	        pass: pass
	    }
	   };


    var transporter = nodemailer.createTransport(smtpConfig);
    transporter.use('compile', htmlToText());
    chosen.user = '"Contractium" <'+chosen.user+'>';
    var mailOptions = {
      from: chosen.user,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html
    };
    return new Promise( (resolve, _) => {
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          let log: SystemLog = {
            event: 'send_mail',
            subject: 'mailer',
            after: `error: ${error.message} to email: ${mail.to}, subject: ${mail.subject}`,
            user_id: userId || null
          };

          writeLog(log);
          _(error);
          return console.log(error);
        }

        let log: SystemLog = {
          event: 'send_mail',
          subject: 'mailer',
          after: `success: to email: ${mail.to}, subject: ${mail.subject}`,
          user_id: userId
        };

        resolve(info.response);
        writeLog(log);
        console.log('Message sent: ' + info.response);
      });
    });


  }

  public async sendForgotPasswordMail(to: string, code: string, userId?:number) {

    let content = `Password recovery code: ${code} <br>Note: this code only exists in 5 minutes`;
    let content_text = misc.replaceAll(content, "<br>", "");

    let forgotMail = {
      to: to,
      subject: `Password recovery code`,
      text: content_text,
      html: content
    };
    return this.sendMail(forgotMail, userId);
  }

  public async sendVerifyMail (user) {
    // let template = mailTemplate.verifyTemplate(data);
    user.link = config.mail.verifylink + "/" + user.username + "/" + user.code;;
    let template = mailTemplate.toHtml('verify', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Please activate your account on Contractium.',
      html: template
    };
    return this.sendMail(content, user.id);
  }

  public async sendActivateCode(user, code: string) {
    let template = mailTemplate.verifyTemplateUsingCode(user, code);
    let content = {
      to: user.email,
      subject: template.subject,
      text: template.content_text,
      html: template.content
    };
    return this.sendMail(content, user.id);
  }

  public async forgotPassword (user, role, password_type) {
    let template = mailTemplate.forgotPassTemplate(user, role, password_type);
    let content = {
      to: user.email,
      subject: template.subject,
      text: template.content_text,
      html: template.content
    };
    return this.sendMail(content, user.id);
  }

  async sendChangePassword2(user: {salt: string, username: string, email: string, id:number}) {
    let template = mailTemplate.changePassWord2Template(user);
    let content = {
      to: user.email,
      subject: template.subject,
      text: template.content_text,
      html: template.content
    };

    return this.sendMail(content, user.id);
  }

  async sendRegisteredSuccess(user) {
    let template = mailTemplate.toHtml('new-user', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. You registered account on Contractium successfully.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendChangePasswordSuccess(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('password', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Your request to change password successfully.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendActiveSuccess(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('active-success', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. You account is now activated.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendLoginSuccess(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('login', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. You are logged in successfully.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendFollowMedia(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('media', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Follow us on social media.',
      html: template
    }
    return this.sendMail(content, user.id);
  }  

  async sendUpdateWallet(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('wallet', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Update your ETH wallet to join our network.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendUpdateKYC(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('kyc', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Register your KYC on our network.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendUpdateSocial(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('social', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Update your profile to be connected.',
      html: template
    }
    return this.sendMail(content, user.id);
  }
  
  async sendUpdateKYCSuccess(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('kyc-success', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. Congratulation for your KYC registration.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendReferral(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('referral', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. You can join our referral program now.',
      html: template
    }
    return this.sendMail(content, user.id);
  }

  async sendReferralSuccess(user) {
    user.link = config.mail.websitelink;
    let template = mailTemplate.toHtml('referral-success', {user});
    let content = {
      to: user.email,
      subject: user.fullname + '. You got free CTU via referral today.',
      html: template
    }
    return this.sendMail(content, user.id);
  }
};

const mailHelper = new MailHelper();
export default mailHelper;
