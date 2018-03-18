import misc from "../libs/misc";


export = function (){
  let arr = ['a', 'b', 'c'];
  let combine = misc.combinations(arr, " ");
  console.log("combine", JSON.stringify(combine));
}
