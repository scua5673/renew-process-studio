const test=require('node:test'),assert=require('node:assert/strict');
const {isPhone,phone,expandedInfo,expanded,readOnly}=require('../studio/board-phone-view.js');
test('phone remains a viewer in landscape and desktop-site mode',()=>{
 for(const data of [{kind:'phone',width:932,height:430},{ua:'iPhone',touch:5,width:932,height:430},{ua:'Mozilla Macintosh',touch:5,width:932,height:430},{ua:'Android Mobile',touch:5,width:900,height:412}])assert.equal(isPhone(data),true);
});
test('iPad and desktop retain editing even in narrow windows',()=>{
 for(const data of [{kind:'ipad',narrow:true,touch:5},{kind:'desktop',narrow:true,touch:5},{ua:'iPad',touch:5,width:1024,height:768,narrow:true},{ua:'Macintosh',touch:5,width:1024,height:768,narrow:true},{ua:'Macintosh',touch:0,width:1440,height:900,narrow:true},{ua:'Android',touch:5,width:1280,height:800,narrow:true}])assert.equal(isPhone(data),false);
});
test('shell device identity takes precedence over iframe dimensions',()=>{
 const w={top:{document:{documentElement:{getAttribute:()=> 'ipad'}}},navigator:{maxTouchPoints:5,userAgent:'Macintosh'},screen:{width:1024,height:768},matchMedia:()=>({matches:true})};
 assert.equal(phone(w),false);w.top.document.documentElement.getAttribute=()=> 'phone';assert.equal(phone(w),true);
});
test('expanded physical display unlocks editing, not phone rotation or desktop-site zoom',()=>{
 assert.equal(expandedInfo({phone:true,screenWidth:1088,screenHeight:759,windowWidth:1088}),true);
 assert.equal(expandedInfo({phone:true,screenWidth:759,screenHeight:1088,windowWidth:759}),true);
 for(const info of [
  {screenWidth:932,screenHeight:430,windowWidth:932},
  {screenWidth:393,screenHeight:852,windowWidth:1100},
  {screenWidth:1088,screenHeight:759,windowWidth:393},
  {screenWidth:0,screenHeight:0,windowWidth:1088}
 ])assert.equal(expandedInfo({phone:true,...info}),false);
 assert.equal(expandedInfo({phone:false,screenWidth:1088,screenHeight:759,windowWidth:1088}),false);
});
test('fold/unfold uses the outer display; keyboard height and scaled iframe do not change permission',()=>{
 const top={document:{documentElement:{getAttribute:()=> 'phone'}},innerWidth:1088,innerHeight:759,screen:{width:1088,height:759}};
 const w={top,navigator:{maxTouchPoints:5,userAgent:'Android Mobile'},screen:top.screen,innerWidth:900,innerHeight:400};
 assert.equal(expanded(w),true);assert.equal(readOnly(w),false);
 top.innerHeight=310;assert.equal(readOnly(w),false,'keyboard keeps the same editing permission');
 top.innerWidth=400;top.screen={width:400,height:900};assert.equal(readOnly(w),true);
 top.innerWidth=900;assert.equal(readOnly(w),true,'ordinary phone landscape stays a viewer');
 top.innerWidth=1088;top.screen={width:1088,height:759};assert.equal(readOnly(w),false);
});
