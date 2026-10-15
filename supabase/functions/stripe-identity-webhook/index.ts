import Stripe from "npm:stripe@17.7.0";
import {createClient} from "npm:@supabase/supabase-js@2";
Deno.serve(async req=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET"),key=Deno.env.get("STRIPE_SECRET_KEY");
 const dbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),url=Deno.env.get("SUPABASE_URL");
 if(!secret||!key||!dbKey||!url||!key.startsWith("sk_test_"))return new Response("Not configured",{status:503});
 const stripe=new Stripe(key,{apiVersion:"2024-12-18.acacia"});
 let event;
 try{event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get("stripe-signature")||"",secret);}catch{return new Response("Invalid signature",{status:400});}
 if(!["identity.verification_session.verified","identity.verification_session.requires_input","identity.verification_session.canceled"].includes(event.type))return Response.json({ok:true});
 const session=event.data.object as Stripe.Identity.VerificationSession;
 const userId=session.metadata?.user_id;
 if(!userId||session.client_reference_id!==userId)return new Response("Invalid user reference",{status:400});
 const status=event.type==="identity.verification_session.verified"?"verified":event.type==="identity.verification_session.canceled"?"canceled":"needs_retry";
 const db=createClient(url,dbKey);
 const {data:existing,error:readError}=await db.from("identity_verifications").select("status,stripe_session_id").eq("user_id",userId).maybeSingle();
 if(readError)return new Response("Unable to check verification",{status:500});
 if(existing?.status==="verified" && status!=="verified")return Response.json({ok:true});
 const {error}=await db.from("identity_verifications").upsert({user_id:userId,stripe_session_id:session.id,status,verified_at:status==="verified"?new Date().toISOString():null},{onConflict:"user_id"});
 if(error)return new Response("Unable to record verification",{status:500});
 return Response.json({ok:true});
});
