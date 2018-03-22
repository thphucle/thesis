var express = require('express');
var router = express.Router();
require("events/index");
import * as v1 from "../../controllers/v1";
import auth from "../../middlewares/auth";
import dataGather from "middlewares/data-gather";
import cronModel from "models/cron";
import * as jobCron from "jobs/cronjob";
import * as jobPromotion from "jobs/promotion";

router.post(`/webhook/transaction`, auth.isValidBitgo, (v1 as any).bitgo.handleBuyPackage);
router.post(`/webhook/transaction/outcome`, auth.isValidBitgo, (v1 as any).bitgo.handleOutcome);
router.post(`/webhook/bitdeal`, (v1 as any).bitdeal.handleBuyPackage);
router.post("/phone-request", (v1 as any)['phone-request'].sendTelegramCode);
router.post("/user/forgot-password", (v1 as any).user.forgotPasswordRequest);
router.post("/user/reset-password", (v1 as any).user.resetPassword);
router.get("/user/verify/:username/:code", (v1 as any).user.verify);
router.get("/meta/rates", (v1 as any).meta.getExchangeRates);


router.use(auth.mIsAuthorized);
router.use(dataGather.gatherData);
let ignores = ["default", "helper"];

router.get("/user/listfromuser/titlehistory", (v1 as any).user.listFromUserTitleHistory);
router.get("/user/listfromuser", (v1 as any).user.listFromUsername);
router.get("/user/link-account-token", (v1 as any).user.getLinkAccountToken);
router.get("/user/f1-commissions", (v1 as any).user.getF1Commissions);
router.post("/user/staff", (v1 as any).user.createStaffUser);
router.get("/wallet/balance", (v1 as any).wallet.getBalance);
router.get("/wallet/limit", (v1 as any).wallet.getLimit);
router.post("/wallet/manual-update-wallet", (v1 as any).wallet.manualUpdate);
router.post("/wallet/transfer", (v1 as any).wallet.transfer);
router.post("/withdraw/complete", (v1 as any).withdraw.complete);
router.get("/title/calculate", (v1 as any).title.calculate);
router.get("/title/reset", (v1 as any).title.reset);
router.get("/statistics/dashboard", (v1 as any).statistics.dashboardStat);
router.post("/meta/updates", (v1 as any).meta.updateMetas);
router.post("/ico-package/confirm", (v1 as any)['ico-package'].confirm);
router.post("/ico-package/reject", (v1 as any)['ico-package'].reject);
router.post("/ico-package/manual-create", (v1 as any)['ico-package'].manualCreate);
router.get("/phone-request/generate-otp", (v1 as any)['phone-request'].generateOtp);
router.post("/phone-request/verify-otp", (v1 as any)['phone-request'].verifyOtp);
router.post("/identity-request/verify", (v1 as any)['identity-request'].verify);
router.post("/identity-request/reject", (v1 as any)['identity-request'].reject);
router.post("/token/manual-create", (v1 as any).token.manualCreate);
router.get("/bounty/get-all-bounty", (v1 as any).bounty.getAllBounty);
router.post("/login/check", (v1 as any).login.check);

for (let key of Object.keys(v1)) {
  
  if (ignores.contains(key))
    continue;
  try {
    let api = v1[key];
    router.get(`/${key}`, api.list);
    router.get(`/${key}/:id`, api.retrieve);
    router.post(`/${key}`, api.create);
    router.put(`/${key}/:id?`, api.update);
    router.delete(`/${key}/:id`, api.destroy);
  } catch (e) {
    console.error(key, e.stack);
  }
}


router.post("/user/change-password", (v1 as any).user.changePassword);
router.post("/user/request-change-password2", (v1 as any).user.requestChangePassword2);
router.post("/user/validate-phone", (v1 as any).user.validatePhone);
router.post("/user/otp-qrcode", (v1 as any).user.getOTPQrcode);
router.post("/user/remove-otp-qrcode", (v1 as any).user.removeOTPQrcode);
router.post("/user/clear-otp", (v1 as any).user.clearOTP);
router.post("/token/check", (v1 as any).login.checkToken);

router.get("/user/count-active-child/:id", (v1 as any).user.countChildActive);
router.post("/order/cancel-order", (v1 as any).order.cancelOrder);

module.exports = router;
