import { schemas } from "schemas";
import cronModel from "models/cron";

const promotionsConfig = [
  {
    total: 10000,
    min_active_f1: 3,
    max_branch_invest: 5000,
    name: "Travel Training Cambodia"
  },
  {
    total: 40000,
    min_active_f1: 3,
    max_branch_invest: 20000,
    name: "Iphone 8"
  },
  {
    total: 80000,
    min_active_f1: 3,
    max_branch_invest: 40000,
    name: "Honda VISION"
  },
  {
    total: 200000,
    min_active_f1: 3,
    max_branch_invest: 100000,
    name: "United States Tours & Travel"
  },
  {
    total: 900000,
    min_active_f1: 3,
    max_branch_invest: 450000,
    name: "Mecedes C200"
  }  
];

let g_result = {};

function handle(user) {
  try {
    let rs = calcPromotion(user);
    if (rs) {
      let {promotion, sum_branch} = rs;
      
      if (!g_result[promotion.name]) {
        g_result[promotion.name] = [];
      }

      let dataPushArray:any = {
        id: user.id,
        max_invest: user.max_invest,
        total_invest: user.total_invest,
        max_title: user.max_title,
        username: user.username,
        count_active_childs: user.count_active_childs        
      };      

      dataPushArray.childs = (user.childs || []).map(c => c.total_invest);
      dataPushArray.sum_branch = sum_branch;
      g_result[promotion.name].push(dataPushArray);
    }
    if (!user.childs) return;

    user.childs.forEach(c => handle(c));
  } catch (error) {
    console.error(error);
  }
}

function calcPromotion(user) {
  if (!user.childs || !user.childs.length) return;
  let {total_invest, count_active_childs} = user;
  let i = promotionsConfig.length - 1;  
  for (; i >= 0; i--) {
    let pro = promotionsConfig[i];
    let sumBranch = user.childs.reduce((sum, next) => sum + Math.min(pro.max_branch_invest, next.total_invest), 0);
    if (pro.min_active_f1 <= count_active_childs && 
      sumBranch >= pro.total) {

      return {promotion: pro, sum_branch: sumBranch};
    }
  }
}

async function calc() {
  try {
    let from_month = 10,
    to_month = 11;    

    let now = new Date();
    let thisMonth = now.getUTCMonth() + 1;
    let include = [];
    
    from_month = from_month || 10;
    to_month = to_month || (new Date()).getMonth() + 1;      

    let users = await schemas.User.findAll({      
      include: [        
        {
          model: schemas.TitleHistory,           
          where: {
            month: {
              $gte: from_month,
              $lte: to_month
            }
          },
          attributes: ['total_invest', 'network_title'],
          paranoid: false,
          required: false,
        },
        {model: schemas.Token}
      ],
      offset: 0,
      limit: 99999999,        
      attributes: ['id', 'referral_id', 'max_invest', 'total_invest', 'max_title', 'username', 'bdl_address']
    });    

    let usersJSON = [];
    for (let user of users) {
      usersJSON.push(user.toJSON());
    }

    console.log("USERJSON ", usersJSON[0]);
    let roots = cronModel.buildBTree(usersJSON);

    function visit(user) {
      if (!user) return;
      let total_invest = user.TitleHistories && user.TitleHistories.reduce((sum, n) => sum + n.total_invest, 0);
      total_invest = total_invest || 0;
  
      let childs = user.childs || [];
      let activeChilds = childs.filter(u => u.Tokens && u.Tokens.length > 0);
      user.total_invest = total_invest;
      user.count_active_childs = activeChilds.length;
      childs.forEach(u => visit(u));      
    }    

    for (let root of roots) {
      console.log("ROOT ", root);
      visit(root);
      handle(root);
    }

    return roots;

  } catch (error) {
    console.error(error);
  }
}

module.exports = async (req, res) => {
  try {
    g_result = {};
    let roots = await calc();
    res.send(g_result);
  } catch (error) {
    console.error(error);
  }
}