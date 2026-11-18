/* GitHub Pages uses Supabase. The existing loopback preview remains available. */
const useLocalPreview=WildRideConfig.localPreview&&['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('cloud')!=='1';
window.WildRideMember=useLocalPreview?WildRideLocalMember:WildRideCloudMember;
if(useLocalPreview){WildRideMember.mode='local';WildRideMember.certificateUrl=id=>'/api/certificates/'+encodeURIComponent(id)+'/pdf'}
