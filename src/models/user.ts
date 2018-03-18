import {schemas} from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import misc from "libs/misc";
import esms from "libs/esms";
import auth from "libs/auth";
import mailHelper from "controllers/helpers/mail-helper";
import * as config from "libs/config";

const LEVELS = [
  {
    title: "Director",
    count_F1: 70,
    total_leader: 2,
    leader_name: "BM"
  },
  {
    title: "BM",
    count_F1: 50,
    total_leader: 2,
    leader_name: "Senior ASM"
  },
  {
    title: "Senior ASM",
    count_F1: 40,
    total_leader: 2,
    leader_name: "ASM"
  },
  {
    title: "ASM",
    count_F1: 30,
    total_leader: 2,
    leader_name: "Senior"
  },
  {
    title: "Senior",
    count_F1: 20,
    total_leader: 2,
    leader_name: "Supervisor"
  },
  {
    title: "Supervisor",
    count_F1: 10,
    total_leader: 2,
    leader_name: "Team Leader"
  },
  {
    title: "Team Leader",
    count_F1: 5,
    total_leader: 0,
    leader_name: null
  },
  {
    title: "Freelance",
    count_F1: 0,
    total_leader: 0,
    leader_name: null
  }
]

function levelize(node) {
  let levelNodes: any[] = [];
  function visit(node, level) {
    if (!node) return;

    if (!levelNodes[level]) {
      levelNodes[level] = [];
    }

    levelNodes[level].push(node);
    visit(node.left, level + 1);
    visit(node.right, level + 1);
  }

  visit(node, 0);

  return levelNodes;
}

/**
 * Get the left/right most of tree
 * @param root current node
 * @param branch left or right
 */
function getBranchMost(root: any, branch: string) {
  let next = root[branch];
  if (!next) return root;
  return getBranchMost(next, branch);
}

/**
 * 
 * @param levelNodes array of array's node
 */
function findAvailableNode(levelNodes) {
  for (let i = 0; i < levelNodes.length; i++) {
    for (let node of levelNodes[i]) {
      if (!node.left || !node.right) {
        return node;
      }
    }
  }
}

async function buildTree(root_id: number) {
  let users = await schemas.User.findAll({
    raw: true,
    where: {
      path: {
        $like: '%/' + root_id + '/%'
      }
    },        
    attributes: ['id', 'username', 'referral_id', 'parent_id', 'left_id', 'right_id'],
    order: [['id', 'ASC']]
  });

  let root, hash:any = {};

  users.forEach(u => {
    hash[u.id] = u;
  });

  users.forEach(u => {        
    u['left'] = hash[u.left_id];
    u['right'] = hash[u.right_id];        
    if (u.id == root_id) {
      root = u;
    }
  });

  return root;
}

export default {
  async sendCode (phone, action) {
    // send sms using esms
    let code = misc.generateCode(6, true);
    let now = (new Date()).getTime();
    await schemas.UserRequest.create({
      action: action,
      code: code,
      phone: phone,
      expired_at: new Date(now + 2*60*60*1000)
    });

    let sendSmsResult = await esms.send({
      phone: phone,
      message: code + " is your verify code!"
    });

    if (sendSmsResult && sendSmsResult.code != 100) {
      // send active code failed. Do something
      console.error("Send activation sms faild :: ");
    }
    return sendSmsResult;
  },
  async checkPhoneValidateRequest (phone, code) {
    let request = await schemas.UserRequest.findOne({
      where: {
        phone: phone,
        code: code,
        action: 'validate_phone'
      }
    });
    if (!request) {
      return ResponseTemplate.error({
        message: "Request does not exits!",
        code: ResponseCode.DATA_NOT_FOUND,
        error: {
          phone, code
        }
      });
    }

    if (request.expired_at && request.expired_at.getTime() < new Date().getTime()) {
      return ResponseTemplate.error({
        message: 'Request was expired!',
        code: ResponseCode.SESSION_TIMEOUT,
        error: {
          phone, code
        }
      })
    }
    await request.destroy();
    return ResponseTemplate.success({});
  },
  async listFromUsername(data) {
    try {
      let {username} = data;

      let users = await schemas.User.findAll({
        where: {
          path: {
            $like: '%/' + username + '/%'
          }
        },
        include: [{model: schemas.User, as: 'referral', attributes: ['id', 'username']}],
        attributes: {
          exclude: ['password', 'password2']
        },
        order: [['updated_at', 'DESC']]
      });

      return ResponseTemplate.success({
        count: users.length,
        data: users
      });
    }
    catch (e) {
      console.error(e);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  },

  async calcBalance (user_id) {
    try {
      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        return ResponseTemplate.dataNotFound("User", { user_id });
      }

      let balance = await schemas.Wallet.sum("usd", {
        where: {
          user_id,
          status: {
            $ne: 'deleted'
          }
        }
      });

      return ResponseTemplate.success({
        data: balance
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  checkUsername (username) {
    if (username.length < 6) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_IMPLICIT,
        message: "Username must have at least 6 characters!",
        error: { username }
      });
    }
  	var myRegEx  = /[^a-z\d]/g;
  	var isValid = !(myRegEx.test(username));
  	if (!isValid) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_IMPLICIT,
        message: "Username only consists of numbers and lower case letters",
        error: { username }
      });
    }

    if (username.includes('bitdeal')) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_IMPLICIT,
        message: "Username must not include 'bitdeal'!",
        error: { username }
      });
    }

    return ResponseTemplate.success({});
  },

  async countF1 (user_id) {
    let count = await schemas.User.count({
      where: {
        referral_id: user_id
      }
    });
    return count || 0;
  },

  async countLeader (userId, levelTitle) {
    if (!userId || !levelTitle) return 0;
    let count = await schemas.User.count({
      where: {
        path: {
          $like: '%/' + userId + '/%'
        },
        level: levelTitle
      }
    });

    return count || 0;
  },

  async getLevel (user) {
    for (let level of LEVELS) {
      let countF1 = await this.countF1(user.id);
      let countLeader = await this.countLeader(user.id, level.leader_name);

      if (countF1 >= level.count_F1 && countLeader >= level.total_leader) {
        return level.title;
      }
    }
    return false;
  },

  async updatePassword (user_id, password:string, new_password: string) {
    try {
      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        return ResponseTemplate.dataNotFound(`User ${user_id}`);
      }

      if (misc.sha256(password) !== user.password) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'Password incorrect',
          error: null
        });
      }

      let rs = await user.update({
        password: misc.sha256(new_password)
      });
      delete rs.password;
      delete rs.password2;
      delete rs.salt;
      await mailHelper.sendChangePasswordSuccess(rs);
      
      return ResponseTemplate.success({
        data: rs
      });
    } catch (error) {

    }
  },

  async requestChangePassword2 (user_id:number, current_password2:string) {
    let user = await schemas.User.findByPrimary(user_id);
    if (!user) {
      return ResponseTemplate.dataNotFound(`User ${user_id}`);
    }

    if (misc.sha256(current_password2) !== user.password2) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: 'Password 2 incorrect',
        error: null
      });
    }
    try {
      let rs = await mailHelper.sendChangePassword2(user);
      return ResponseTemplate.success();
    } catch (error) {
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Send email failed',
        error: error
      });
    }

  },

  async changePassword(username: string, password: string, password_type: string, salt?: string) {
    let user = await schemas.User.findOne({
      where: {
        username        
      }
    });

    if (!user) {
      return ResponseTemplate.dataNotFound(`User ${username}`);
    }

    if (salt && user.salt != salt) {
      return ResponseTemplate.accessDenied(`Salt invalid`);
    }

    if (password.length < 8) {
      return ResponseTemplate.error({
        error: null,
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Password ${password_type} must be at least 8 characters`
      });
    }

    let newSalt = misc.generateCode(32, true);

    if (['password_1', 'password_2'].indexOf(password_type) == -1) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Password type invalid`,
        error: password_type
      });
    }

    if (password_type == 'password_1') {
      await user.update({
        password: misc.sha256(password),
        salt: newSalt
      });
    } else {
      await user.update({
        password2: misc.sha256(password),
        salt: newSalt
      });
    }

    return ResponseTemplate.success();
  },

  async getOTPQrcode (user_id: number, password: string) {
    let user = await schemas.User.findByPrimary(user_id);
    if (!user) {
      return ResponseTemplate.dataNotFound(user_id);
    }

    if (password && misc.sha256(password) !== user.password) {
      return ResponseTemplate.error({
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: 'Password incorrect',
        error: password
      });
    }

    let secret = user.otp_secret;
    let qrcodeUrl = '';

    if (!secret) {
      var otpSecret = auth.generateOtpSecret({length: 30});
      secret = otpSecret;
      console.log("secret", secret);
      await user.update({
        otp_secret: secret
      });
    }

    qrcodeUrl = auth.generateOtpQRCode(user.username, secret, 'BDL NETWORK');
    return ResponseTemplate.success({
      data: qrcodeUrl
    });
  },

  async autoChooseBranch(root_id: number, branch: string) {
    try {
      let users = await schemas.User.findAll({
        raw: true,
        where: {
          path: {
            $like: '%/' + root_id + '/%'
          }
        },        
        attributes: ['id', 'username', 'parent_id', 'left_id', 'right_id'],
        order: [['id', 'ASC']]
      });

      let root, hash:any = {};

      users.forEach(u => {
        hash[u.id] = u;
      });

      users.forEach(u => {        
        u['left'] = hash[u.left_id];
        u['right'] = hash[u.right_id];        
        if (u.id == root_id) {
          root = u;
        }
      });
      
      let foundNode = getBranchMost(root, branch);
      
      if (!foundNode) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_AVAILABLE,
          message: `Something went wrong`,
          error: root_id
        });
      }

      return ResponseTemplate.success({
        data: foundNode.id
      });
    } catch (error) {
      console.error(error);
      return ResponseTemplate.internalError(error.message);
    }
  },

  async findFirstF1s(user_id: number) {
    try {
      let tree = await buildTree(user_id);

      let leftNodes = levelize(tree.left);
      let rightNodes = levelize(tree.right);
      let leftFirstF1, rightFirstF1;

      for (let levelNodes of leftNodes) {
        let found = levelNodes.find(n => n.referral_id == user_id);
        if (found) {
          leftFirstF1 = found;
          break;
        }
      }

      for (let levelNodes of rightNodes) {
        let found = levelNodes.find(n => n.referral_id == user_id);        
        if (found) {
          rightFirstF1 = found;
          break;
        }
      }

      return ResponseTemplate.success({
        data: {
          left: leftFirstF1 && leftFirstF1.username,
          right: rightFirstF1 && rightFirstF1.username,
        }
      });
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  },

  /**
   * Call this function if a user wallet receives return, commission, capital,
   * it checkout current user's maxout and update maxout. In additional,
   * it update active token to completed if user's status is inactive (is_active = false)
   * @param user_id 
   * @param amount amount of commission, return, capital
   * @param data aditional data you want to update
   */
  async updateUserInfo(user_id: number, amount: number, data?:any) {
    let user = await schemas.User.findByPrimary(user_id);
  
    if (!user.is_active) {
      await user.update(data);
      return user;
    }
  
    let limitMaxout = user.limit_maxout;
    let maxout = user.maxout;
    let isActive = user.is_active;
  
    if (maxout + amount >= limitMaxout) {
      maxout = limitMaxout;
      isActive = false;
    } else {
      maxout += amount;
    }

    let dataUpdate = Object.assign({}, data, {
      is_active: isActive,
      maxout
    });
  
    await user.update(dataUpdate);

    if (!isActive) {
      await schemas.Token.update(
        {
          status: 'completed'
        },
        {
          where: {
            status: 'active',
            user_id
          }
        }
      );
    }
  }
}
