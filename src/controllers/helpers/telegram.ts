import * as config from "libs/config";
import Request from 'libs/request';
import misc from 'libs/misc';
var request = new Request({});

const isTesting = process.env.NODE_ENV == 'development';

export default {
  async send (message, groupId ?: number){
    try {
      var url = config.telegram && config.telegram.url;
      groupId = groupId || (config.telegram && config.telegram.group_token);
      
      message = config.app.debug ? `[TEST] ` + message : message;
      var result = await request.post(url, {
        chat_id: groupId,
        text: message
      });
      
      return result;
    } catch (e) {
      console.log(e.stack);
      return {
        code: -1,
        message: 'Cannot send to telegram group: ' + groupId
      }
    }
  },

  toSupport(ticket:{title: string, message: string, id: number, from?:string}) {
    const group_support = config.telegram.group_support;
    if (!group_support) {
      return new Error("Group support is null");
    }

    let message = 
    `Ticket #${ticket.id}: ${config.server.base_url}/admin/support/${ticket.id}
    User: ${ticket.from}
    Title: ${ticket.title}.
    Message: ${misc.stripHtml(ticket.message)}.
    Photos: ${misc.extractImageSrcs(ticket.message).join('\n')}
    `;
    return this.send(message, group_support);
  },

  toIssue(message: string) {
    const group_issue_report = config.telegram.group_issue_report;
    if (!group_issue_report) {
      return new Error("Group is null");
    }

    return this.send(message, group_issue_report);
  },

  toDeposit(message: string) {
    const group_deposit = config.telegram.group_deposit;
    if (!group_deposit) {
      return new Error("Group is null");
    }

    return this.send(message, group_deposit);
  },
  toWithdraw(data: {username: string, amount: number, status: string, user_balance: number, system_balance: number}) {
    const group_withdraw = config.telegram.group_withdraw;
    let {username, amount, user_balance, system_balance, status} = data;

    if (!group_withdraw) {
      return new Error("Group withdraw is not found");
    }

    const now = new Date();
    let message = ` ${isTesting ? '[TEST]' : ''}
    [WD] ${username} ${misc.formatNumber(amount)}
${misc.formatNumber(user_balance)} | ${misc.formatNumber(system_balance)}
${status} | ${now.toISOString().substr(5, 14).replace("T", " ")}`;

    return this.send(message, group_withdraw);
  }
 }
