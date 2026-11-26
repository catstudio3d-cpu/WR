import urllib.request, urllib.error, json
BASE='https://fyqlfldjoaikmxowmrfi.supabase.co/functions/v1/'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args): return None
opener=urllib.request.build_opener(NoRedirect)
def call(path,body=None,headers=None):
    req=urllib.request.Request(BASE+path,data=body,headers=headers or {})
    try: response=opener.open(req,timeout=25)
    except urllib.error.HTTPError as e: response=e
    return response.status,response.read().decode(),response.headers
status,body,headers=call('ecpay-checkout');assert status==200,(status,body);assert json.loads(body)['environment']=='stage'
status,body,_=call('ecpay-checkout',b'{"action":"create"}',{'Content-Type':'application/json'});assert status==401,(status,body)
status,body,_=call('ecpay-notify',b'MerchantID=3002607&CheckMacValue=invalid',{'Content-Type':'application/x-www-form-urlencoded'});assert status==400,(status,body)
status,body,headers=call('ecpay-return');assert status==303,(status,body);assert headers['Location']=='https://catstudio3d-cpu.github.io/WR/payment-result.html'
status,body,_=call('ecpay-checkout',headers={'Origin':'https://untrusted.example'});assert status==403,(status,body)
print('PASS: deployed staging config, missing login rejected, forged callback rejected, safe return redirect, foreign origin rejected.')
