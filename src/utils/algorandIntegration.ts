// utils/algorandIntegration.ts
import algosdk from 'algosdk';

// Smart contract constants - replace with your actual values in production
const AGREEMENT_REGISTRY_APP_ID = parseInt(process.env.NEXT_PUBLIC_AGREEMENT_REGISTRY_APP_ID || '0');
const IDENTITY_REGISTRY_APP_ID = parseInt(process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_APP_ID || '0');

// Algorand network configuration
const ALGORAND_SERVER = 'https://testnet-api.algonode.cloud';
const ALGORAND_PORT = 443;
const ALGORAND_TOKEN = '';  // Not needed for AlgoNode

// Define types
interface Signer {
  name?: string;
  email?: string;
  walletAddress: string;
}

interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

interface VerificationSignature {
  walletAddress: string;
  signed: boolean;
}

interface VerificationData {
  agreementId: string;
  documentHash: string;
  status: string;
  signatures: VerificationSignature[];
}

interface VerificationResult extends TransactionResult {
  stage?: string;
  results?: TransactionResult[];
  executeResult?: TransactionResult;
}

interface AgreementDetails {
  id: number;
  documentHash: string | null;
  provider: string | null;
  executed: boolean;
  signers: Array<{address: string, signed: boolean}>;
  metadata: Record<string, string>;
}

// Helper function to create Algorand client
const getAlgoClient = (): algosdk.Algodv2 => {
  return new algosdk.Algodv2(ALGORAND_TOKEN, ALGORAND_SERVER, ALGORAND_PORT);
};

// Connect to wallet (requires AlgoSigner or equivalent)
export const connectWallet = async (): Promise<string> => {
  if (typeof window !== 'undefined' && typeof (window as any).AlgoSigner !== 'undefined') {
    await (window as any).AlgoSigner.connect();
    const accounts = await (window as any).AlgoSigner.accounts({
      ledger: 'TestNet'
    });
    return accounts[0].address;
  } else {
    throw new Error('AlgoSigner not installed');
  }
};

// Create an agreement on-chain
export const createAgreement = async (
  senderAddress: string, 
  documentHash: string, 
  provider: string, 
  signers: Signer[]
): Promise<TransactionResult> => {
  try {
    const client = getAlgoClient();
    const suggestedParams = await client.getTransactionParams().do();
    
    // Prepare application arguments using TextEncoder
    const encoder = new TextEncoder();
    const appArgs = [
      encoder.encode('create_agreement'),
      new Uint8Array(Buffer.from(documentHash.replace('0x', ''), 'hex')),
      encoder.encode(provider)
    ];
    
    // Add signers to app args
    signers.forEach(signer => {
      appArgs.push(algosdk.decodeAddress(signer.walletAddress).publicKey);
    });
    
    // Create the transaction
    const txn = new algosdk.Transaction({
      type: algosdk.TransactionType.appl,
      sender: senderAddress,
      suggestedParams: suggestedParams,
      appCallParams: {
        appIndex: AGREEMENT_REGISTRY_APP_ID,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: appArgs,
        foreignApps: [IDENTITY_REGISTRY_APP_ID]
      }
    });
    
    // Sign and submit transaction
    const signedTxn = await (window as any).AlgoSigner.signTransaction([
      {
        txn: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
      }
    ]);
    
    const { txId } = await (window as any).AlgoSigner.send({
      ledger: 'TestNet',
      tx: signedTxn[0].blob
    });
    
    return { success: true, txId };
  } catch (error) {
    console.error('Error creating agreement:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Mark a signer as having signed (can only be called by a verifier)
export const markSigned = async (
  verifierAddress: string, 
  agreementId: number, 
  signerWallet: string
): Promise<TransactionResult> => {
  try {
    const client = getAlgoClient();
    const suggestedParams = await client.getTransactionParams().do();
    
    // Prepare application arguments
    const encoder = new TextEncoder();
    const appArgs = [
      encoder.encode('mark_signed'),
      algosdk.encodeUint64(agreementId),
      algosdk.decodeAddress(signerWallet).publicKey
    ];
    
    // Create the transaction
    const txn = new algosdk.Transaction({
      type: algosdk.TransactionType.appl,
      sender: verifierAddress,
      suggestedParams: suggestedParams,
      appCallParams: {
        appIndex: AGREEMENT_REGISTRY_APP_ID,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: appArgs,
        foreignApps: [IDENTITY_REGISTRY_APP_ID]
      }
    });
    
    // Sign and submit transaction
    const signedTxn = await (window as any).AlgoSigner.signTransaction([
      {
        txn: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
      }
    ]);
    
    const { txId } = await (window as any).AlgoSigner.send({
      ledger: 'TestNet',
      tx: signedTxn[0].blob
    });
    
    return { success: true, txId };
  } catch (error) {
    console.error('Error marking signer:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Execute agreement after all signers have signed
export const executeAgreement = async (
  senderAddress: string, 
  agreementId: number
): Promise<TransactionResult> => {
  try {
    const client = getAlgoClient();
    const suggestedParams = await client.getTransactionParams().do();
    
    // Prepare application arguments
    const encoder = new TextEncoder();
    const appArgs = [
      encoder.encode('execute_agreement'),
      algosdk.encodeUint64(agreementId)
    ];
    
    // Create the transaction
    const txn = new algosdk.Transaction({
      type: algosdk.TransactionType.appl,
      sender: senderAddress,
      suggestedParams: suggestedParams,
      appCallParams: {
        appIndex: AGREEMENT_REGISTRY_APP_ID,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: appArgs,
        foreignApps: [IDENTITY_REGISTRY_APP_ID]
      }
    });
    
    // Sign and submit transaction
    const signedTxn = await (window as any).AlgoSigner.signTransaction([
      {
        txn: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
      }
    ]);
    
    const { txId } = await (window as any).AlgoSigner.send({
      ledger: 'TestNet',
      tx: signedTxn[0].blob
    });
    
    return { success: true, txId };
  } catch (error) {
    console.error('Error executing agreement:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Process DocuSign verification data and submit to blockchain
export const processVerificationData = async (
  verifierAddress: string, 
  verificationData: VerificationData
): Promise<VerificationResult> => {
  try {
    const agreementId = parseInt(verificationData.agreementId);
    const allSigned = verificationData.signatures.every(sig => sig.signed);
    
    // Mark each signer
    const markResults: TransactionResult[] = [];
    for (const signature of verificationData.signatures) {
      if (signature.signed) {
        const result = await markSigned(
          verifierAddress,
          agreementId,
          signature.walletAddress
        );
        markResults.push(result);
        
        // If any marking fails, return early
        if (!result.success) {
          return {
            success: false,
            stage: 'marking_signers',
            results: markResults,
            error: result.error
          };
        }
      }
    }
    
    // If all signatures are present, execute the agreement
    let executeResult: TransactionResult | null = null;
    if (allSigned) {
      executeResult = await executeAgreement(verifierAddress, agreementId);
      
      if (!executeResult.success) {
        return {
          success: false,
          stage: 'executing_agreement',
          results: markResults,
          executeResult,
          error: executeResult.error
        };
      }
    }
    
    return {
      success: true,
      stage: allSigned ? 'agreement_executed' : 'signatures_marked',
      results: markResults,
      executeResult: executeResult || undefined
    };
  } catch (error) {
    console.error('Error processing verification data:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Get agreement details from blockchain
export const getAgreementDetails = async (agreementId: number): Promise<AgreementDetails> => {
  try {
    const client = getAlgoClient();
    
    // Get global state for agreement
    const appInfo = await client.getApplicationByID(AGREEMENT_REGISTRY_APP_ID).do();
    
    // In a real implementation, you would parse the global state to extract
    // agreement details. This is a simplified mock since the structure depends
    // on your specific implementation.
    const mockAgreementKey = `agreement_${agreementId}`;
    const mockSignerPrefix = `signer_${agreementId}_`;
    const mockMetaPrefix = `meta_${agreementId}_`;
    
    // Assuming we need to access the global state from the app's parameters
    // This might need adjustment based on the actual structure returned by the API
    const globalState = appInfo.params?.['globalState'] || 
                        appInfo.params?.globalState || 
                        [];
    
    const agreementDetails: AgreementDetails = {
      id: agreementId,
      documentHash: null,
      provider: null,
      executed: false,
      signers: [],
      metadata: {}
    };
    
    // Process globals
    globalState.forEach((item: any) => {
      const key = Buffer.from(item.key, 'base64').toString();
      
      // Parse based on key pattern
      if (key === mockAgreementKey) {
        // Parse agreement details from value
        const valueBuffer = Buffer.from(item.value.bytes, 'base64');
        agreementDetails.documentHash = `0x${valueBuffer.slice(0, 32).toString('hex')}`;
        agreementDetails.provider = valueBuffer.slice(32, 64).toString().replace(/\0/g, '');
        agreementDetails.executed = valueBuffer[64] === 1;
      } else if (key.startsWith(mockSignerPrefix)) {
        // Parse signer address and status
        const address = key.substring(mockSignerPrefix.length);
        const signed = item.value.uint === 1;
        agreementDetails.signers.push({ address, signed });
      } else if (key.startsWith(mockMetaPrefix)) {
        // Parse metadata
        const metaKey = key.substring(mockMetaPrefix.length);
        const metaValue = item.value.bytes 
          ? Buffer.from(item.value.bytes, 'base64').toString() 
          : item.value.uint.toString();
        agreementDetails.metadata[metaKey] = metaValue;
      }
    });
    
    return agreementDetails;
  } catch (error) {
    console.error('Error getting agreement details:', error);
    throw error;
  }
};

export default {
  connectWallet,
  createAgreement,
  markSigned,
  executeAgreement,
  processVerificationData,
  getAgreementDetails
};