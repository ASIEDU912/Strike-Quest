/* Public guest-preview identity and explicit availability. No storage writes or network. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 document.body.dataset.release='10.3.2';
 const badge=document.querySelector('.studio-review-label');if(badge)badge.textContent='Quest Renewal · 10.3.2';
 const panel=$('studioAccounts');if(panel){const note=document.createElement('p');note.id='sqPublicAccountAvailability';note.className='notice';note.textContent='Continue as guest. Live account sign-in, recovery and cloud synchronization are not enabled here. Nothing will upload automatically.';panel.querySelector('summary').after(note);}
})();
