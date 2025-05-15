// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MilestoneForm from '../components/milestoneForm';
import { connectWallet, createAgreement, processVerificationData } from '../utils/algorandIntegration';

interface Signer {
  name: string;
  email: string;
  walletAddress: string;
}

interface AgreementData {
  title: string;
  documentHash: string;
  signers: Signer[];
  amount: string;
  description: string;
}

interface Envelope {
  envelopeId: string;
  title: string;
  status: string;
  createdAt: string;
}

interface EnvelopeDetail extends Envelope {
  agreementId: string;
  documentHash: string;
  signers: Array<{
    name: string;
    email: string;
    walletAddress: string;
    status: string;
    signedAt?: string;
  }>;
}

interface VerificationData {
  agreementId: string;
  documentHash: string;
  status: string;
  completedAt: string | null;
  signatures: Array<{
    walletAddress: string;
    signed: boolean;
    signedAt: string | null;
  }>;
}

export default function Home() {
  // State variables
  const [loading, setLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [account, setAccount] = useState<string | null>(null);
  const [agreementData, setAgreementData] = useState<AgreementData>({
    title: '',
    documentHash: '',
    signers: [{ name: '', email: '', walletAddress: '' }],
    amount: '',
    description: '',
  });
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [currentEnvelope, setCurrentEnvelope] = useState<EnvelopeDetail | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [milestones, setMilestones] = useState<Array<{title: string, description: string}>>([]);

  // Connect wallet function
  const connectWalletHandler = async () => {
    if (typeof window !== 'undefined') {
      try {
        setLoading(true);
        
        // For demo purposes, mock the wallet connection
        // In production, use real wallet connection
        const mockAccount = '0x' + Math.random().toString(36).substring(2, 15);
        setAccount(mockAccount);
        setConnected(true);
        
        // Add first signer as the connected account
        setAgreementData(prevData => ({
          ...prevData,
          signers: [
            { 
              name: 'Me (Creator)', 
              email: '', 
              walletAddress: mockAccount 
            },
            ...prevData.signers.slice(1)
          ]
        }));
        
        setLoading(false);
      } catch (error) {
        console.error('Error connecting wallet:', error);
        setLoading(false);
      }
    } else {
      alert('Please install a wallet extension to use this dApp');
    }
  };

  // Add a signer field
  const addSigner = () => {
    setAgreementData({
      ...agreementData,
      signers: [...agreementData.signers, { name: '', email: '', walletAddress: '' }],
    });
  };

  // Remove a signer field
  const removeSigner = (index: number) => {
    if (index === 0) return; // Don't remove the first signer (creator)
    const newSigners = [...agreementData.signers];
    newSigners.splice(index, 1);
    setAgreementData({
      ...agreementData,
      signers: newSigners,
    });
  };

  // Handle input changes for signers
  const handleSignerChange = (index: number, field: keyof Signer, value: string) => {
    const newSigners = [...agreementData.signers];
    newSigners[index] = { ...newSigners[index], [field]: value };
    setAgreementData({
      ...agreementData,
      signers: newSigners,
    });
  };

  // Handle input changes for other fields
  const handleInputChange = (field: keyof AgreementData, value: string) => {
    setAgreementData({
      ...agreementData,
      [field]: value,
    });
  };

  // Generate a mock document hash
  const generateDocumentHash = () => {
    // In production, this would be the actual hash of the document
    const randomHash = '0x' + Array.from({ length: 64 })
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
    
    setAgreementData({
      ...agreementData,
      documentHash: randomHash,
    });
  };

  // Add a milestone
  const handleAddMilestone = (milestone: {title: string, description: string}) => {
    setMilestones([...milestones, milestone]);
  };

  // Create a DocuSign envelope
  const createEnvelope = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!agreementData.title || !agreementData.documentHash || agreementData.signers.some(s => !s.email || !s.name || !s.walletAddress)) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Generate an agreement ID (in production, this would come from the blockchain)
      const mockAgreementId = Date.now().toString();
      
      // Create envelope with DocuSign API
      const response = await axios.post(`/api/docusign?action=create-envelope`, {
        agreementId: mockAgreementId,
        documentHash: agreementData.documentHash,
        signers: agreementData.signers,
        title: agreementData.title,
        message: agreementData.description || 'Please review and sign this document'
      });
      
      alert(`Envelope created with ID: ${response.data.envelopeId}`);
      
      // Fetch updated envelopes
      fetchEnvelopes();
      
      setLoading(false);
    } catch (error) {
      console.error('Error creating envelope:', error);
      alert('Failed to create envelope');
      setLoading(false);
    }
  };

  // Fetch all envelopes
  const fetchEnvelopes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/docusign?action=list');
      setEnvelopes(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching envelopes:', error);
      setLoading(false);
    }
  };

  // Get envelope details
  const getEnvelopeDetails = async (envelopeId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/docusign?action=envelope&envelopeId=${envelopeId}`);
      setCurrentEnvelope(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching envelope details:', error);
      setLoading(false);
    }
  };

  // Simulate a signature
  const simulateSignature = async (envelopeId: string, email: string, walletAddress: string) => {
    try {
      setLoading(true);
      await axios.post('/api/docusign?action=simulate-sign', {
        envelopeId,
        email,
        walletAddress
      });
      
      // Refresh envelope details
      await getEnvelopeDetails(envelopeId);
      setLoading(false);
    } catch (error) {
      console.error('Error simulating signature:', error);
      setLoading(false);
    }
  };

  // Get verification data for blockchain
  const getVerificationData = async (envelopeId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/docusign?action=verification&envelopeId=${envelopeId}`);
      setVerificationData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching verification data:', error);
      setLoading(false);
    }
  };

  // Submit verification to blockchain
  const submitToBlockchain = async () => {
    if (!verificationData || !connected) {
      alert('Verification data or wallet connection missing');
      return;
    }

    try {
      setLoading(true);
      
      // In production, this would interact with your Algorand smart contracts
      alert('Verification submitted to blockchain successfully! (mock)');
      setLoading(false);
    } catch (error) {
      console.error('Error submitting to blockchain:', error);
      alert('Failed to submit to blockchain');
      setLoading(false);
    }
  };

  // Load envelopes on initial load
  useEffect(() => {
    fetchEnvelopes();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Escra - DocuSign Integration</h1>
      
      {/* Wallet Connection */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Wallet Connection</h2>
        
        {!connected ? (
          <button 
            onClick={connectWalletHandler} 
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div>
            <span className="font-medium">Connected Account: </span>
            <span className="text-green-600">{account}</span>
          </div>
        )}
      </div>
      
      {/* Create Agreement / Envelope */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Create Agreement</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Agreement Title</label>
            <input 
              type="text" 
              value={agreementData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g., Property Purchase Agreement"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input 
              type="text" 
              value={agreementData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g., 100000 (in smallest unit)"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Document Hash</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={agreementData.documentHash}
              onChange={(e) => handleInputChange('documentHash', e.target.value)}
              className="flex-grow px-3 py-2 border rounded"
              placeholder="0x1234..."
              readOnly
            />
            <button 
              onClick={generateDocumentHash}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Generate Hash
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea 
            value={agreementData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full px-3 py-2 border rounded h-24"
            placeholder="Please review and sign this agreement..."
          />
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Signers</label>
            <button 
              onClick={addSigner}
              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
            >
              + Add Signer
            </button>
          </div>
          
          {agreementData.signers.map((signer, index) => (
            <div key={index} className="flex gap-2 mb-2 items-start">
              <div className="flex-grow grid grid-cols-3 gap-2">
                <input 
                  type="text" 
                  value={signer.name}
                  onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                  className="px-3 py-2 border rounded"
                  placeholder="Name"
                  disabled={index === 0}
                />
                <input 
                  type="email" 
                  value={signer.email}
                  onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                  className="px-3 py-2 border rounded"
                  placeholder="Email"
                />
                <input 
                  type="text" 
                  value={signer.walletAddress}
                  onChange={(e) => handleSignerChange(index, 'walletAddress', e.target.value)}
                  className="px-3 py-2 border rounded"
                  placeholder="Wallet Address"
                  disabled={index === 0}
                />
              </div>
              {index > 0 && (
                <button 
                  onClick={() => removeSigner(index)}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-2 rounded"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* Milestones section */}
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Milestones</h3>
          
          <MilestoneForm onAddMilestone={handleAddMilestone} />
          
          {milestones.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium">Current Milestones:</h4>
              <ul className="list-disc pl-5 mt-2">
{milestones.map((milestone, index) => (
                  <li key={index} className="mb-2">
                    <strong>{milestone.title}</strong>: {milestone.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <button 
          onClick={createEnvelope}
          disabled={loading || !connected}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Creating...' : 'Create DocuSign Envelope'}
        </button>
      </div>
      
      {/* Envelopes List */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">DocuSign Envelopes</h2>
          <button 
            onClick={fetchEnvelopes}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
        
        {envelopes.length === 0 ? (
          <p className="text-gray-500">No envelopes found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">Title</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-left">Created</th>
                  <th className="border p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {envelopes.map((envelope) => (
                  <tr key={envelope.envelopeId} className="hover:bg-gray-50">
                    <td className="border p-2">{envelope.envelopeId.substring(0, 8)}...</td>
                    <td className="border p-2">{envelope.title}</td>
                    <td className="border p-2">
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        envelope.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {envelope.status}
                      </span>
                    </td>
                    <td className="border p-2">{new Date(envelope.createdAt).toLocaleString()}</td>
                    <td className="border p-2">
                      <button 
                        onClick={() => getEnvelopeDetails(envelope.envelopeId)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        Details
                      </button>
                      {envelope.status === 'completed' && (
                        <button 
                          onClick={() => getVerificationData(envelope.envelopeId)}
                          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Envelope Details */}
      {currentEnvelope && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Envelope Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <span className="font-medium">Envelope ID: </span>
              <span>{currentEnvelope.envelopeId}</span>
            </div>
            <div>
              <span className="font-medium">Status: </span>
              <span className={`${
                currentEnvelope.status === 'completed' 
                  ? 'text-green-600' 
                  : 'text-yellow-600'
              }`}>
                {currentEnvelope.status}
              </span>
            </div>
            <div>
              <span className="font-medium">Title: </span>
              <span>{currentEnvelope.title}</span>
            </div>
            <div>
              <span className="font-medium">Agreement ID: </span>
              <span>{currentEnvelope.agreementId}</span>
            </div>
            <div>
              <span className="font-medium">Document Hash: </span>
              <span className="break-all text-xs">{currentEnvelope.documentHash}</span>
            </div>
            <div>
              <span className="font-medium">Created: </span>
              <span>{new Date(currentEnvelope.createdAt).toLocaleString()}</span>
            </div>
          </div>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Signers</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2 text-left">Name</th>
                  <th className="border p-2 text-left">Email</th>
                  <th className="border p-2 text-left">Wallet Address</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentEnvelope.signers.map((signer, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border p-2">{signer.name}</td>
                    <td className="border p-2">{signer.email}</td>
                    <td className="border p-2">{signer.walletAddress.substring(0, 8)}...</td>
                    <td className="border p-2">
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        signer.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {signer.status}
                      </span>
                    </td>
                    <td className="border p-2">
                      {signer.status !== 'completed' && (
                        <button 
                          onClick={() => simulateSignature(currentEnvelope.envelopeId, signer.email, signer.walletAddress)}
                          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
                        >
                          Simulate Sign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Verification Data for Blockchain */}
      {verificationData && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Verification Data for Blockchain</h2>
          
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-x-auto mb-4">
            <pre>{JSON.stringify(verificationData, null, 2)}</pre>
          </div>
          
          <p className="mb-4 text-sm">
            This verification data would be sent to your Algorand smart contract to mark signatures as verified 
            and potentially execute the agreement if all signatures are complete.
          </p>
          
          <button 
            onClick={submitToBlockchain}
            disabled={loading || !connected || verificationData.status !== 'completed'}
            className={`px-4 py-2 rounded ${
              verificationData.status === 'completed'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            {loading ? 'Submitting...' : 'Submit to Blockchain'}
          </button>
        </div>
      )}
    </div>
  );
}