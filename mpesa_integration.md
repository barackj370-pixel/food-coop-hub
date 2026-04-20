import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const body = await req.json();

    // ------------------------------------------------------------------
    // ROUTE 1: INITIATE STK PUSH (C2B) - Users sending KES to the Coop
    // ------------------------------------------------------------------
    if (url.pathname.endsWith('/initiate-c2b')) {
      const { phone, amount_kes, wallet_id } = body;
      
      const shortcode = Deno.env.get('MPESA_SHORTCODE') || '';
      const passkey = Deno.env.get('MPESA_PASSKEY') || '';
      const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY') || '';
      const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET') || '';

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = btoa(`${shortcode}${passkey}${timestamp}`);

      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
      });
      const { access_token } = await tokenRes.json();

      const callbackURL = `https://YOUR_PROJECT_ID.supabase.co/functions/v1/mpesa-api/c2b-callback`; 

      const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount_kes,
          PartyA: phone, 
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackURL,
          AccountReference: wallet_id,
          TransactionDesc: `Topup CoopPesa`
        })
      });

      const stkData = await stkRes.json();
      return new Response(JSON.stringify(stkData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ------------------------------------------------------------------
    // ROUTE 2: B2C PAYMENT REQUEST - Coop sending KES to Users (Loans)
    // ------------------------------------------------------------------
    if (url.pathname.endsWith('/b2c-disburse')) {
      const { phone, amount_kes, loan_id } = body;
      
      const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY') || '';
      const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET') || '';

      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
      });
      const { access_token } = await tokenRes.json();

      // B2C specific credentials
      const initiatorName = Deno.env.get('MPESA_INITIATOR_NAME') || '';
      const securityCredential = Deno.env.get('MPESA_SECURITY_CREDENTIAL') || '';
      const shortcode = Deno.env.get('MPESA_SHORTCODE') || '';

      const callbackURL = `https://YOUR_PROJECT_ID.supabase.co/functions/v1/mpesa-api/b2c-callback`;

      const b2cRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          InitiatorName: initiatorName,
          SecurityCredential: securityCredential,
          CommandID: 'BusinessPayment', // Routine payment
          Amount: amount_kes,
          PartyA: shortcode, 
          PartyB: phone,     
          Remarks: `Loan Disbursement for ${loan_id}`,
          QueueTimeOutURL: callbackURL,
          ResultURL: callbackURL,
          Occasion: `CoopPesa Loan`
        })
      });

      const b2cData = await b2cRes.json();
      return new Response(JSON.stringify(b2cData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ------------------------------------------------------------------
    // ROUTE 3: C2B CALLBACK WEBHOOK (Safaricom confirming Topup)
    // ------------------------------------------------------------------
    if (url.pathname.endsWith('/c2b-callback')) {
      const callbackData = body?.Body?.stkCallback;
      
      if (callbackData && callbackData.ResultCode === 0) {
        console.log("PAYMENT SUCCESSFUL received from Safaricom");
        // Mint CoopPesa logic here via Supabase
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // ------------------------------------------------------------------
    // ROUTE 4: B2C CALLBACK WEBHOOK (Safaricom confirming Disbursement)
    // ------------------------------------------------------------------
    if (url.pathname.endsWith('/b2c-callback')) {
       // Update loan status from "pending_disbursement" to "active" via Supabase
       console.log('B2C Callback Received:', JSON.stringify(body));
       return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response("Route not found", { status: 404 })

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error?.message || 'Server Error' }), { status: 500, headers: corsHeaders })
  }
})
