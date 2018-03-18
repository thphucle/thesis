import Request from "libs/request";
import {schemas} from "schemas";
import misc from "libs/misc";

const BASE_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=10.7801338,106.6694916&radius=500&key=AIzaSyDh7olwm15ryXpVPq7e-uvVa6aex-67C_Q';

module.exports = async () => {
  const types = ['cafe', 'lodging', 'restaurant', 'shopping_mall', 'spa'];
  let usernames = [];
  let request = new Request({});
  let count = 1;
  for (let type of types) {
    let url = `${BASE_URL}&type=${type}`;
    let rs = await request.get(url);
    let geos = rs.results;
    
    console.log("TYPE ", type, geos.length);
    for (let geo of geos) {
      let location_id = geo.place_id;
      let title = geo.name;
      let address = geo.vicinity;
      let username = title;
      username = misc.normalize(username.toLowerCase().replace(/\s/g, '').replace(/-/g, ''));      
      let phone = `+840972156${misc.pad(count, 3)}`;
      let email = `fake${misc.pad(count, 3)}@gmail.com`;
      let newSalt = misc.generateCode(10, true);

      let findShop = await schemas.Shop.findOne({
        where: {
          username
        }
      })

      if (findShop) continue;

      let updateData = {
        title,
        address,
        phone,
        username,
        email,
        password: misc.sha256('123456'),
        salt: misc.sha256(newSalt),
        referral_id: 1,
        status: 'verified',
        location_id,
        national: '+84'
      };

      console.log("Shop ", username);
      let shop = await schemas.Shop.create(updateData);

      await schemas.Branch.create({
        title: shop.title || "",
        address: shop.address || "",
        phone: shop.phone,
        location_id: shop.location_id || "",
        shop_id: shop.id
      });

      console.log("shop ", shop.toJSON());
      count++;
    }
  }

  console.log("DONE ", count);
}
