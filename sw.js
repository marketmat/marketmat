self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={title:'Market Mat',body:'New Market Mat alert'};
  try{if(event.data)data=event.data.json()}catch(_){}
  event.waitUntil(self.registration.showNotification(data.title||'Market Mat',{body:data.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'market-mat-alert',data:data.url||'/'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const target=event.notification.data||'/';
    for(const client of list){if('focus' in client)return client.focus()}
    if(clients.openWindow)return clients.openWindow(target);
  }));
});