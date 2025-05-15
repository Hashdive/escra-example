// src/app/api/docusign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Mock database for storing envelope data (in memory for demo)
const envelopeDatabase = new Map<string, any>();

// Mock DocuSign JWT token
let mockJwtToken: string | null = null;
let mockJwtExpiry = Date.now() + 3600000; // 1 hour from now

/**
 * GET handler for DocuSign API endpoints
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const envelopeId = searchParams.get('envelopeId');
  
  // Get envelope details
  if (action === 'envelope' && envelopeId) {
    const envelope = envelopeDatabase.get(envelopeId);
    
    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }
    
    return NextResponse.json(envelope);
  }
  
  // Get verification data
  if (action === 'verification' && envelopeId) {
    const envelope = envelopeDatabase.get(envelopeId);
    
    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }
    
    // Prepare verification data for blockchain
    const verificationData = {
      agreementId: envelope.agreementId,
      documentHash: envelope.documentHash,
      status: envelope.status,
      completedAt: envelope.completedAt,
      signatures: envelope.signers.map((signer: any) => ({
        walletAddress: signer.walletAddress,
        signed: signer.status === 'completed',
        signedAt: signer.signedAt
      }))
    };
    
    return NextResponse.json(verificationData);
  }
  
  // List all envelopes
  if (action === 'list') {
    const envelopes = Array.from(envelopeDatabase.values());
    return NextResponse.json(envelopes);
  }
  
  return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
}

/**
 * POST handler for DocuSign API endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action');
    
    // Create an envelope
    if (action === 'create-envelope') {
      const { 
        agreementId, 
        documentHash, 
        signers, 
        title,
        message 
      } = body;
      
      if (!agreementId || !documentHash || !signers || signers.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      // Validation for signers
      for (const signer of signers) {
        if (!signer.email || !signer.name || !signer.walletAddress) {
          return NextResponse.json({ 
            error: 'Each signer must have email, name, and walletAddress' 
          }, { status: 400 });
        }
      }
      
      // Generate a mock envelope ID
      const envelopeId = 'env-' + Math.random().toString(36).substring(2);
      
      // Create mock envelope record
      const envelope = {
        envelopeId,
        agreementId,
        documentHash,
        title: title || `Agreement ${agreementId}`,
        message: message || 'Please review and sign this document',
        signers: signers.map((signer: any) => ({
          ...signer,
          status: 'sent',
          signedAt: null
        })),
        status: 'sent',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      
      // Store in our mock database
      envelopeDatabase.set(envelopeId, envelope);
      
      return NextResponse.json({
        envelopeId,
        status: 'sent',
        uri: `/api/docusign?action=envelope&envelopeId=${envelopeId}`
      }, { status: 201 });
    }
    
    // Simulate signing
    if (action === 'simulate-sign') {
      const { envelopeId, email, walletAddress } = body;
      
      if (!envelopeId || !email || !walletAddress) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      const envelope = envelopeDatabase.get(envelopeId);
      if (!envelope) {
        return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
      }
      
      // Find the signer and update status
      const signer = envelope.signers.find(
        (s: any) => s.email === email && s.walletAddress === walletAddress
      );
      
      if (!signer) {
        return NextResponse.json({ error: 'Signer not found in envelope' }, { status: 404 });
      }
      
      signer.status = 'completed';
      signer.signedAt = new Date().toISOString();
      
      // Check if all signers have completed
      const allSigned = envelope.signers.every((s: any) => s.status === 'completed');
      if (allSigned) {
        envelope.status = 'completed';
        envelope.completedAt = new Date().toISOString();
      }
      
      return NextResponse.json({
        envelopeId,
        signer: { email, walletAddress, status: 'completed' },
        envelopeStatus: envelope.status
      });
    }
    
    // If we get here, the action is invalid or not supported
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

/**
 * Helper function to regenerate the mock JWT token if needed
 */
function ensureMockJwtToken() {
  if (!mockJwtToken || Date.now() > mockJwtExpiry) {
    mockJwtToken = 'mock-jwt-token-' + Math.random().toString(36).substring(2);
    mockJwtExpiry = Date.now() + 3600000; // 1 hour from now
  }
  return mockJwtToken;
}

/**
 * Mock implementation for simulated authentication
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}