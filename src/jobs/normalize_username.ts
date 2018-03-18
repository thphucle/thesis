import { schemas } from "schemas";
import mailHelper from "controllers/helpers/mail-helper";
import Telegram from "controllers/helpers/telegram";
import * as uuid from "uuid";
import userModel from "models/user";
import misc from "libs/misc";

let usernameErrors = [];
export = async function () {
  let userErrors = [];
  let users = await schemas.User.findAll();

  for (let user of users) {
    let checkUsername = userModel.checkUsername(user.username);
    if (checkUsername.error) {
      userErrors.push(user);
    }
  }
  console.log("User error :: ", userErrors.length);
  usernameErrors = [];
  for (let user of userErrors) {
    try {
      await fixUsername(user);
    } catch (e) {
      console.error("change username error :: ", user.id, user.username);
    }
  }
  // console.log("Error :: ", usernameErrors, usernameErrors.length);
}

async function fixUsername (user) {
  let name = getUsernameValid(user);
  await user.update({
    username: name
  });

  sendMail(user, name);
}

function sendMail (user, newName) {
  let message = `
  Hi ${user.username}, <br />
  To ensure system consistency, we decided to change your username to: ${newName}.<br />
  Please use this to login our website. <br />
  Thanks and best regards,`
  let text = message.replace(/<br \/>/g, '');

  mailHelper.sendMail({
    to: user.email,
    subject: `BITDEAL's announcement for ${user.username}`,
    text: text,
    html: message
  });
}

function getUsernameValid (user) {
  let username = misc.normalize(user.username);
  username = username.toLowerCase().replace(/ /g, '');
  let check = userModel.checkUsername(username);
  if (!check.error) return username;

  let email = misc.normalize(user.email);
  email = email.split("@")[0];
  email = email.toLowerCase().replace(/ /g, '');
  check = userModel.checkUsername(email);
  if (!check.error) return email;

  let new_name = misc.normalize(user.fullname);
  new_name = new_name.toLowerCase().replace(/ /g, '');
  check = userModel.checkUsername(new_name);
  if (!check.error) return new_name;

  usernameErrors.push(user.toJSON());
  return email + new_name;
}
