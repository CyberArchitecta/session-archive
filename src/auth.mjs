import { randomBytes, timingSafeEqual } from 'node:crypto';
import { InvalidGrantError, InvalidTokenError, InvalidScopeError, InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
export const secret = () => randomBytes(32).toString('base64url');
export const equal = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class OwnerOAuth {
  constructor(ownerKey, baseUrl) {
    this.ownerKey=ownerKey; this.baseUrl=baseUrl; this.resource=baseUrl+'/mcp';
    this.clients=new Map(); this.pending=new Map(); this.codes=new Map(); this.tokens=new Map(); this.refresh=new Map();
    this.clientsStore={
      getClient: async id=>this.clients.get(id),
      registerClient: async client=>{
        if(this.clients.size>=200) throw new InvalidClientMetadataError('Client limit reached; restart to clear registrations.');
        if(!client.redirect_uris?.length || client.redirect_uris.some(uri=>{
          try { const u=new URL(uri); return !!u.hash || !!u.username || !!u.password || !(u.protocol==='https:' || (u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname))); }
          catch { return true; }
        })) throw new InvalidClientMetadataError('Use HTTPS or loopback HTTP redirect URLs, without fragments or credentials.');
        this.clients.set(client.client_id,client); return client;
      }
    };
  }
  prune() {
    const now=Date.now();
    for(const map of [this.pending,this.codes,this.tokens,this.refresh]) for(const [id,v] of map) if(v.expires<=now)map.delete(id);
  }
  checkResource(resource) { if(resource && resource.toString()!==this.resource) throw new InvalidGrantError('Wrong resource.'); }
  checkScopes(scopes) { if(scopes?.some(s=>s!=='archive:read')) throw new InvalidScopeError('Only archive:read is supported.'); }
  async authorize(client,params,res) {
    this.prune(); this.checkResource(params.resource); this.checkScopes(params.scopes);
    if(this.pending.size>=200) throw new InvalidGrantError('Too many pending authorizations.');
    const nonce=secret();
    this.pending.set(nonce,{clientId:client.client_id,params,expires:Date.now()+300000,attempts:0});
    res.set('Cache-Control','no-store');
    res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><title>Connect Session Archive</title><main class="consent"><p class="eyebrow">SESSION ARCHIVE</p><h1>Allow read access?</h1><p>Client: <strong>'+escape(client.client_name||client.client_id)+'</strong></p><p>Redirect: <code>'+escape(params.redirectUri)+'</code></p><p>This grants access to all sessions and text attachments in this archive. It cannot import, edit, or delete data.</p><form method="post" action="/consent"><input type="hidden" name="nonce" value="'+nonce+'"><label>Archive owner key<input type="password" name="ownerKey" required autocomplete="off"></label><p class="muted">Copy your key from the local terminal using <code>session-archive key</code>. Enter it only on your own archive server.</p><button type="submit">Allow read access</button></form><p>Close this page to cancel.</p></main></html>');
  }
  consent(nonce,key) {
    this.prune();
    const p=this.pending.get(nonce);
    if(!p)throw new InvalidGrantError('Authorization expired. Start again.');
    p.attempts++;
    if(p.attempts>5){this.pending.delete(nonce);throw new InvalidGrantError('Too many attempts. Start again.');}
    if(!equal(key,this.ownerKey))throw new InvalidGrantError('Incorrect archive owner key.');
    this.pending.delete(nonce);
    const code=secret();
    this.codes.set(code,{...p,expires:Date.now()+60000});
    const u=new URL(p.params.redirectUri);u.searchParams.set('code',code);
    if(p.params.state!==undefined)u.searchParams.set('state',p.params.state);
    return u.toString();
  }
  code(client,code) {
    this.prune();const entry=this.codes.get(code);
    if(!entry||entry.clientId!==client.client_id)throw new InvalidGrantError('Invalid or expired authorization code.');
    return entry;
  }
  async challengeForAuthorizationCode(client,code) { return this.code(client,code).params.codeChallenge; }
  issue(clientId) {
    this.prune();
    if(this.tokens.size>=1000||this.refresh.size>=1000) throw new InvalidGrantError('Token limit reached; restart to revoke existing connections.');
    const access=secret(),refresh=secret(),expires=Date.now()+3600000;
    this.tokens.set(access,{clientId,expires});
    this.refresh.set(refresh,{clientId,expires:Date.now()+7*86400000,access});
    return {access_token:access,refresh_token:refresh,token_type:'Bearer',expires_in:3600,scope:'archive:read'};
  }
  async exchangeAuthorizationCode(client,code,_verifier,redirectUri,resource) {
    const entry=this.code(client,code);this.checkResource(resource);
    if(redirectUri!==entry.params.redirectUri)throw new InvalidGrantError('Redirect URI does not match authorization.');
    this.codes.delete(code);return this.issue(client.client_id);
  }
  async exchangeRefreshToken(client,token,scopes,resource) {
    this.prune();this.checkResource(resource);this.checkScopes(scopes);
    const t=this.refresh.get(token);
    if(!t||t.clientId!==client.client_id)throw new InvalidGrantError('Invalid refresh token.');
    this.refresh.delete(token);this.tokens.delete(t.access);return this.issue(client.client_id);
  }
  async verifyAccessToken(token) {
    this.prune();const t=this.tokens.get(token);
    if(!t)throw new InvalidTokenError('Invalid or expired token.');
    return {token,clientId:t.clientId,scopes:['archive:read'],expiresAt:Math.floor(t.expires/1000),resource:new URL(this.resource)};
  }
  async revokeToken(client,{token}) {
    const t=this.tokens.get(token),r=this.refresh.get(token);
    if(t?.clientId===client.client_id)this.tokens.delete(token);
    if(r?.clientId===client.client_id){this.tokens.delete(r.access);this.refresh.delete(token);}
    for(const [id,v] of this.refresh)if(v.access===token&&v.clientId===client.client_id)this.refresh.delete(id);
  }
}
