const test=require('node:test'),assert=require('node:assert/strict');
const {isPhone,phone}=require('../studio/board-phone-view.js');
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
