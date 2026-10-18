(()=>{
 const styles=[
 {id:'belmir',ar:'بلمير الأصلي',name:'Belmir Classic',colors:['#402d2e','#89876b','#eee7d8']},
 {id:'elegant',ar:'أنيق',name:'Elegant',colors:['#2f2a24','#b9a88d','#faf7f2']},
 {id:'modern',ar:'عصري',name:'Modern',colors:['#1c1917','#ea580c','#ffffff']},
 {id:'minimal',ar:'بسيط',name:'Minimal',colors:['#1c1917','#a8a29e','#ffffff']},
 {id:'noir',ar:'نوار',name:'Noir',colors:['#0b0b0d','#c9a227','#1a1a1f']},
 {id:'market',ar:'ماركت',name:'Market',colors:['#0f766e','#f59e0b','#fffbeb']}
 ];
 const picker=document.querySelector('#design-picker'),options=document.querySelector('.design-options'),share=document.querySelector('#share-design'),feedback=document.querySelector('#design-feedback');
 if(!picker)return;
 function synchronize(values){const url=new URL(location.href);for(const [key,value]of Object.entries(values)){if(value===null||value==='All')url.searchParams.delete(key);else url.searchParams.set(key,value)}history.replaceState(null,'',url.pathname+url.search+url.hash);}
 function apply(id,persist=true){const design=styles.find(s=>s.id===id)||styles[0];if(persist){synchronize({design:design.id});location.assign(location.href);return design.id;}document.body.dataset.design='belmir';options.innerHTML=styles.map(s=>`<button type="button" data-design-option="${s.id}" aria-pressed="${s.id==='belmir'}"><span class="design-swatches" aria-hidden="true">${s.colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span><span class="design-option-name"><span lang="ar">${s.ar}</span><small>${s.name}</small></span><span class="design-check" aria-hidden="true">${s.id==='belmir'?'✓':''}</span></button>`).join('');return 'belmir';}
 apply('belmir',false);
 options.addEventListener('click',event=>{const button=event.target.closest('[data-design-option]');if(!button)return;apply(button.dataset.designOption);picker.open=false;picker.querySelector('summary').focus();feedback.textContent='';});
 picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus()}});
 document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false});
 share?.addEventListener('click',async()=>{synchronize({design:document.body.dataset.design});try{await navigator.clipboard.writeText(location.href);feedback.textContent='Design link copied';}catch{feedback.textContent='Copy the page link from your address bar.'}});
 window.Belmir.designs={styles,apply,synchronize};
})();
