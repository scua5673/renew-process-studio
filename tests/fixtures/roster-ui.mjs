// 선수단 화면 줄이기(A안) — 표 위 단추는 «＋ 선수 ▾» · «⋯» · 선택 띠 «⋯» 셋으로 모였다. 시험이 그 길로 들어가게 하는 도우미.
// 고르개(#psPickPop)가 안 뜨면 한 번 더 누른다(느린 실행기에서 누르는 사이 다시 그려지는 일).
async function openPick(frame,button){for(let i=0;i<6;i++){await button.click();try{await frame.locator('#psPickPop').waitFor({timeout:2500});return;}catch(e){if(i===5)throw e;}}}
export async function addMenu(frame,label){await openPick(frame,frame.locator('#pwAddMenu'));await frame.locator('#psPickPop button',{hasText:label}).click();}
export async function selMore(frame,label){await openPick(frame,frame.locator('#pwTeam [data-pw-action="selMore"]'));await frame.locator('#psPickPop button',{hasText:label}).click();}
export async function etc(frame,key){const item=frame.locator('#tmEtcMenu [data-pw-etc="'+key+'"]');for(let i=0;i<6;i++){if(!(await item.isVisible()))await frame.locator('#tmEtcBtn').click();try{await item.click({timeout:2500});return;}catch(e){if(i===5)throw e;}}}
