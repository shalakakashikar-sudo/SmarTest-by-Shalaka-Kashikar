

import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { Role } from '../types';
import { TableSkeleton } from '../components/SkeletonLoader';

interface User {
    id: string;
    username: string;
    full_name: string;
    created_at: string;
    role: Role;
}

interface UserManagementProps {
  navigateTo: (view: 'dashboard') => void;
}

const UserManagementView: React.FC<UserManagementProps> = ({ navigateTo }) => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    dataService.getUsers()
      .then(data => {
        if (data) {
          setUsers(data);
        }
      })
      .catch(err => addToast(`Failed to load users: ${err.message}`, 'error'))
      .finally(() => setIsLoading(false));
  }, [addToast]);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
        await dataService.deleteUser(userToDelete.id);
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
        addToast('User deleted successfully!', 'success');
    } catch (error: any) {
        addToast(`Failed to delete user: ${error.message}`, 'error');
    } finally {
        setUserToDelete(null);
        setIsDeleting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let usersToDisplay = users;

    // Teachers can only see students. Admins can see everyone fetched.
    if (profile?.role === 'teacher') {
        usersToDisplay = users.filter(user => user.role === 'student');
    }

    if (!searchTerm.trim()) {
      return usersToDisplay;
    }

    const lowercasedFilter = searchTerm.toLowerCase();
    return usersToDisplay.filter(user =>
      (user.full_name && user.full_name.toLowerCase().includes(lowercasedFilter)) ||
      (user.username && user.username.toLowerCase().includes(lowercasedFilter))
    );
  }, [users, searchTerm, profile]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  const roleBadgeClass = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    student: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  };

  const tableColumns = profile?.role === 'admin' ? 6 : 5;

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">👥 User Management</h2>
          <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            placeholder="🔎 Search by name or username..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        
        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Full Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Username</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">User ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Registration Date</th>
                {profile?.role === 'admin' && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton columns={tableColumns} />
            ) : (
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-slate-700">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 font-mono" title={user.id}>{user.id.substring(0,8)}...</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 py-1 rounded-full font-medium text-xs ${roleBadgeClass[user.role]}`}>{user.role.toUpperCase()}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{formatDate(user.created_at)}</td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button 
                              onClick={() => setUserToDelete(user)}
                              disabled={user.id === profile.id}
                              className="text-red-600 hover:text-red-900 font-medium disabled:text-gray-400 disabled:cursor-not-allowed dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                        <td colSpan={tableColumns} className="text-center py-8 text-gray-500 dark:text-gray-400">
                            {users.length === 0 ? 
                                (profile?.role === 'teacher' ? 'No students have been registered yet.' : 'No users have been registered yet.') :
                                'No users match your search criteria.'
                            }
                        </td>
                    </tr>
                  )}
                </tbody>
            )}
          </table>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 dark:bg-slate-800">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 dark:text-slate-100">Confirm Deletion</h3>
                <p className="my-4 text-gray-600 dark:text-gray-300">
                  Are you sure you want to delete the user <span className="font-bold">"{userToDelete.full_name}"</span> ({userToDelete.role})? 
                  This will permanently remove their account and all associated data. This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setUserToDelete(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                    <button onClick={handleDeleteUser} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg disabled:bg-red-400">
                        {isDeleting ? 'Deleting...' : 'Delete User'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default UserManagementView;
