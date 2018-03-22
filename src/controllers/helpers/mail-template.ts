import * as config from "libs/config";
import * as pug from "pug";
import * as path from "path";

function completedBonusTemplate (bonusCompleted) {
	var subject = "Congratulation from Contracitum.io!";
	var timestring = bonusCompleted.created_time.toISOString().replace('T', ' ').substr(0, 16);
	var content = `
	Dear,<br>
	This email to congratulate you on receiving ${bonusCompleted.bonus} (BTC) dailygrowth of campaign #${bonusCompleted.order} on ${timestring}.<br>
	Thanks,
	`
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function completedCommissionTemplate (commissionCompleted) {
	var subject = "Congratulation from Contracitum.io!";
	var timestring = commissionCompleted.created_time.toISOString().replace('T', ' ').substr(0, 16);
	var content = `
	Dear,<br>
	This email to congratulate you on withdrawing successfully ${commissionCompleted.amount} (BTC) commission on ${timestring}.<br>
	Thanks,
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}



async function completedOrderTemplate (orderCompleted) {
	var subject = "Congratulation from Contracitum.io!";
	var timestring = orderCompleted.created_time.toISOString().replace('T', ' ').substr(0, 16);
	var content = `
	Dear,<br>
	This email to congratulate you on buying successfully campaign #${orderCompleted.id} priced ${orderCompleted.amount} (BTC) on ${timestring}.<br>
	Thanks,
	`;
	var content_text= replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

async function completedTokenTemplate (orderCompleted) {
	var subject = "Congratulation from Contracitum.io!";
	var timestring = orderCompleted.created_time.toISOString().replace('T', ' ').substr(0, 16);
	var content = `
	Dear,<br>
	This email to congratulate you on buying successfully tokens priced ${orderCompleted.price} (BTC) on ${timestring}.<br>
	Thanks,
	`;
	var content_text= replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function verifyTemplate (data) {
	var subject = "Verify account from Contractium Network!";
	var vlink  = config.mail.verifylink;
	var link = `${vlink}/${data.username}/${data.code}`;
	var tag = `<a href="${link}">${link}</a>`;

	var content = `
	Dear,<br>
	This email to verify account from our site.<br>
	Your account information includes:<br>`;

	content = content + (data.referral ? `Your referral: ${data.referral}<br>` : '' );
	content = content + `
	Your id: ${data.id}<br>
	Your fullname: ${data.fullname}<br>
	Your phone: ${data.phone}<br>
	`;
	var content_text = replaceAll(content, "<br>", "");
	content += `
	Please verify ${tag}.<br>
	Thanks,
	`;
	content_text += `
	Please verify ${link}.
	Thanks,
	`;

	return { subject, content, content_text };
}

function verifyTemplateUsingCode (data, code) {
	var subject = "Verify account from Contracitum.io!";
	var vlink  = config.mail.verifylink;
	var link = vlink + "/" + data.username + "/" + code;
	var tag = `<a href="${link}">${link}</a>`;

	var content = `
	Dear,<br>
	This email to verify account from our site.<br>
	Your account information includes:<br>
	Your referral: ${data.referral && data.referral.username || ''}<br>
	Your username: ${data.username}<br>
	Your fullname: ${data.fullname}<br>
	Your phone: ${data.national} ${data.phone}<br>
  Your verify code: <b>${code}</b><br>
	`;
	var content_text = replaceAll(content, "<br>", "");
  content_text = replaceAll(content, "<b>", "");
  content_text = replaceAll(content, "</b>", "");
	content += `
	Please verify ${tag}.<br>
	Thanks,
	`;
	content_text += `
	Please verify at: ${link}.
	Thanks,
	`;

	return { subject, content, content_text };
}

function forgotPassTemplate (user, type, password_type) {
  // type are: shop | user
  type = type || "user";
	var subject = `[Contracitum.io] Forgot password ${password_type.split('_')[1]} account ${user.username}`;
	var websitelink = config.mail.websitelink;
	var link = `${websitelink}/${type}/reset-password/${password_type}/${user.username}/${user.salt}`;
	var tag = `<a href="${link}">${link}</a>`;

	var content = `
	Dear,<br>
	This email update new password from our site.<br>
	`;
	var content_text = replaceAll(content, "<br>", "");

	content += `
	Please change it: ${tag}.<br>
	Thanks,
	`;
	content_text += `
	Please change it: ${link}.
	Thanks,
	`;
	return { subject, content, content_text };
}

function changeWalletTemplate (user) {
	var subject = "Change wallet address from Contracitum.io!";
	var user_id = user.username;
	var email = user.email;
	var sand = user.sand;
	var websitelink = config.mail.websitelink;
	var link = websitelink+"/update-wallet/"+user_id+"/"+sand;
	var tag = `<a href="${link}">${link}</a>`;

	var content = `
	Dear,<br>
	This email to change wallet address from our site.<br>
	`;
	var content_text = replaceAll(content, "<br>", "");

	content += `
	Please change it: ${tag}.<br>
	Thanks,
	`;
	content_text += `
	Please change it: ${link}.
	Thanks,
	`;
	return { subject, content, content_text };
}

function changePassWord2Template (user, role = 'user') {
  // type are: user | shop
	var subject = `[Contracitum.io] Change password 2 account ${user.username}`;
	var websitelink = config.mail.websitelink;
	let link = `${websitelink}/${role}/reset-password/password_2/${user.username}/${user.salt}`;
	var tag = `<a href="${link}">${link}</a>`;

	var content = `
	Dear,<br>
	This email update new password 2 of account <b>${user.username}</b> from our site.</br>
	`;
	var content_text = replaceAll(content, "<br>", "");

	content += `
	Click this link to change password 2: ${tag}.<br>
	Thanks,
	`;
	content_text += `
	Click this link to change password 2: ${link}.
	Thanks,
	`;
	return { subject, content, content_text };
}

function notifyReinvestTemplate (user) {
	var subject = "Notification for reinvestment from Contracitum.io!";
	var content = `
	Dear,<br>
	Your campaign just completed a stage. Please, reinvest this campaign in 24 hours to continue.<br>
	Thanks,
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}


function newCompletedTemplate(bonusCompleted, toEmail) {
	var subject = "Congratulation from Contracitum.io!";
  var timestring = bonusCompleted.created_time.toISOString().replace('T', ' ').substr(0, 16);
	var content =`
	Dear,<br>
	This email to congratulate you on receiving ${bonusCompleted.bonus} (BTC) dailygrowth of campaign #${bonusCompleted.order} on ${timestring}.<br>
	Thanks,
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function emailThanksTemplate() {
	var subject = "Thanks from Contracitum.io!";
	var content = `
	Thanks for your dismal Contracitum.io accompanied during the last campaign, so hopefully you will come back with a new campaign as soon as possible.<br>
	Respect Admin
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function withdrawTemplate(user, amount) {
	var subject = "Withdraw in Contracitum.io currency";
	var content = `
		You withdrawed ${amount} BTS, currency: BTS
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function registeredSuccessTemplate(user) {
	var subject = "{user.fullname}. You registered account on Contractium successfully.";
	var content = `
		Hi {user.fullname}, 
		Congratulation!
		You registered account on Contractium.io successfully. Please activate account registration on the upcoming email to join our network.
	`;
	var content_text = replaceAll(content, "<br>", "");
	return { subject, content, content_text };
}

function toHtml(templateName: string, data: any) {
	let filename = templateName;
	let options = {
		cache: process.env.NODE_ENV !== 'development'
	};

	let locals = Object.assign({host: config.mail.websitelink}, data);

	let html = pug.renderFile(
		path.join(__dirname, '../../email-template', `${filename}.pug`), 
		Object.assign(locals, options)
	);

	return html
}

module.exports = {
	completedBonusTemplate,
	completedCommissionTemplate,
	completedOrderTemplate,
	completedTokenTemplate,
	verifyTemplate,
  verifyTemplateUsingCode,
	forgotPassTemplate,
	changeWalletTemplate,
	changePassWord2Template,
	notifyReinvestTemplate,
	newCompletedTemplate,
	emailThanksTemplate,
	withdrawTemplate,
	registeredSuccessTemplate,
	toHtml
}

function replaceAll(text, search, replacement) {
  return text.replace(new RegExp(search, 'g'), replacement);
}
