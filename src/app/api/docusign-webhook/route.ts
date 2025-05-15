// src/app/api/docusign-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';
import { markSigned, executeAgreement } from '../../../utils/algorandIntegration';

interface EnvelopeData {
  envelopeId: string;
  status: string;
  agreementId: string | null;
  signers: Signer[];
}

interface Signer {
  name: string;
  email: string;
  status: string;
  walletAddress: string | null;
  signedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the webhook is actually from DocuSign
    const signature = request.headers.get('x-docusign-signature-1');
    if (!signature) {
      return NextResponse.json({ error: 'Missing DocuSign signature header' }, { status: 400 });
    }
    
    // Get raw body
    const rawBody = await request.text();
    
    // HMAC-SHA256 verification
    const hmac = crypto.createHmac('sha256', process.env.DOCUSIGN_HMAC_SECRET || '');
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('base64');
    
    if (calculatedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // 2. Parse the event data
    const payload = JSON.parse(rawBody);
    
    // 3. Extract relevant envelope data
    const envelopeData: EnvelopeData = {
      envelopeId: payload.envelopeId,
      status: payload.event,
      agreementId: null,  // Will be extracted from envelope custom fields
      signers: []
    };
    
    // 4. If this is a "envelope-completed" event, process it
    if (payload.event === 'envelope-completed') {
      // 5. Get full envelope data from DocuSign
      const envelopeDetails = await getEnvelopeFromDocuSign(payload.envelopeId);
      
      // 6. Extract agreement ID from custom fields
      envelopeData.agreementId = extractAgreementId(envelopeDetails);
      
      // 7. Extract signer information
      envelopeData.signers = extractSigners(envelopeDetails);
      
      // 8. Submit verification to blockchain
      await submitVerificationToBlockchain(envelopeData);
      
      // 9. Return success
      return NextResponse.json({ 
        success: true, 
        message: 'Verification submitted to blockchain',
        envelopeId: envelopeData.envelopeId
      });
    }
    
    // For other events, just acknowledge receipt
    return NextResponse.json({ success: true, message: 'Event received' });
    
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Function to get envelope details from DocuSign
async function getEnvelopeFromDocuSign(envelopeId: string) {
  try {
    // Get access token
    const token = await getDocuSignToken();
    
    // Get account ID
    const accountId = await getDocuSignAccountId(token);
    
    // Get envelope data
    const response = await axios.get(
      `${process.env.DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          include: 'recipients,custom_fields,documents'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting envelope from DocuSign:', error);
    throw error;
  }
}

// Function to get DocuSign access token using JWT Grant
async function getDocuSignToken(): Promise<string> {
  try {
    // In production, implement proper JWT grant flow
    // See: https://developers.docusign.com/platform/auth/jwt/jwt-get-token/
    
    // 1. Create a JWT assertion
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: process.env.DOCUSIGN_INTEGRATOR_KEY,
      sub: process.env.DOCUSIGN_USER_ID,
      aud: process.env.DOCUSIGN_AUTH_SERVER,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation'
    };
    
    // Sign with private key (stored securely)
    const privateKey = process.env.DOCUSIGN_PRIVATE_KEY || '';
    const assertion = crypto.createSign('RSA-SHA256')
      .update(JSON.stringify(jwtPayload))
      .sign({
        key: privateKey,
        passphrase: process.env.DOCUSIGN_PRIVATE_KEY_PASSPHRASE || ''
      }, 'base64');
    
    // 2. Exchange JWT for access token
    const response = await axios.post(
      `${process.env.DOCUSIGN_AUTH_SERVER}/oauth/token`,
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting DocuSign token:', error);
    throw error;
  }
}

// Additional helper functions
// (Extract from previous code)
// ...

// Extract agreement ID from envelope custom fields
function extractAgreementId(envelopeDetails: any): string {
  if (!envelopeDetails.customFields || !envelopeDetails.customFields.textCustomFields) {
    throw new Error('No custom fields found in envelope');
  }
  
  const agreementIdField = envelopeDetails.customFields.textCustomFields.find(
    (field: any) => field.name === 'agreementId'
  );
  
  if (!agreementIdField) {
    throw new Error('No agreementId custom field found in envelope');
  }
  
  return agreementIdField.value;
}

// Extract signers and their wallet addresses from envelope
function extractSigners(envelopeDetails: any): Signer[] {
  if (!envelopeDetails.recipients || !envelopeDetails.recipients.signers) {
    throw new Error('No signers found in envelope');
  }
  
  return envelopeDetails.recipients.signers.map((signer: any) => {
    // Find wallet address in tabs (if available)
    let walletAddress = null;
    
    if (signer.tabs && signer.tabs.textTabs) {
      const walletTab = signer.tabs.textTabs.find((tab: any) => tab.tabLabel === 'walletAddress');
      if (walletTab) {
        walletAddress = walletTab.value;
      }
    }
    
    // If no wallet address found in tabs, check your database or other source
    if (!walletAddress) {
      walletAddress = getWalletAddressFromDatabase(signer.email);
    }
    
    return {
      name: signer.name,
      email: signer.email,
      status: signer.status,
      walletAddress: walletAddress,
      signedAt: signer.signedDateTime
    };
  });
}

// Example function to get wallet address from a database
function getWalletAddressFromDatabase(email: string): string {
  // Mock implementation
  return `0x${crypto.createHash('sha256').update(email).digest('hex').substring(0, 40)}`;
}

// Function to get DocuSign account ID
async function getDocuSignAccountId(token: string): Promise<string> {
  try {
    const response = await axios.get(
      `${process.env.DOCUSIGN_BASE_URL}/oauth/userinfo`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Get the default account ID
    return response.data.accounts[0].account_id;
  } catch (error) {
    console.error('Error getting DocuSign account ID:', error);
    throw error;
  }
}

// Submit verification data to the blockchain
async function submitVerificationToBlockchain(envelopeData: EnvelopeData) {
  // Use a verifier wallet (must be an authorized verifier in the smart contract)
  const verifierAddress = process.env.VERIFIER_WALLET_ADDRESS || '';
  
  if (!envelopeData.agreementId) {
    throw new Error('Agreement ID is missing');
  }
  
  // Mark each signer as having signed
  for (const signer of envelopeData.signers) {
    if (signer.status === 'completed' && signer.walletAddress) {
      await markSigned(
        verifierAddress,
        parseInt(envelopeData.agreementId),
        signer.walletAddress
      );
    }
  }
  
  // If all signers have completed, execute the agreement
  const allSigned = envelopeData.signers.every(
    signer => signer.status === 'completed'
  );
  
  if (allSigned) {
    await executeAgreement(verifierAddress, parseInt(envelopeData.agreementId));
  }
  
  return {
    success: true,
    allSigned
  };
}