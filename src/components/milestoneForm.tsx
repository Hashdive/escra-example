// components/MilestoneForm.tsx
import React, { useState } from 'react';

interface Milestone {
  title: string;
  description: string;
}

interface MilestoneFormProps {
  onAddMilestone: (milestone: Milestone) => void;
}

export default function MilestoneForm({ onAddMilestone }: MilestoneFormProps) {
  const [milestone, setMilestone] = useState<Milestone>({
    title: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddMilestone(milestone);
    setMilestone({ title: '', description: '' });
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium mb-3">Add Milestone</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={milestone.title}
            onChange={(e) => setMilestone({...milestone, title: e.target.value})}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={milestone.description}
            onChange={(e) => setMilestone({...milestone, description: e.target.value})}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>
        <button 
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Milestone
        </button>
      </form>
    </div>
  );
}