import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, api } from '../contexts/AuthContext';
import { Button, Table, Modal, message } from 'antd';
import { ExclamationCircleOutlined, UserSwitchOutlined } from '@ant-design/icons';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, impersonate } = useContext(AuthContext);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (error) {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleImpersonate = (targetUser) => {
    Modal.confirm({
      title: `Impersonate ${targetUser.name || targetUser.email}?`,
      icon: <ExclamationCircleOutlined />,
      content: 'You will be logged in as this user and will be able to perform actions on their behalf. All actions will be audited.',
      onOk: async () => {
        try {
          await impersonate(targetUser.email);
        } catch (error) {
          const msg = error.response?.data?.error || 'Failed to start impersonation';
          message.error(msg);
        }
      },
    });
  };

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a, b) => a.email.localeCompare(b.email) },
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    { title: 'Role', dataIndex: 'role', key: 'role', sorter: (a, b) => a.role.localeCompare(b.role) },
    { title: 'Lab', dataIndex: 'lab', key: 'lab', sorter: (a, b) => (a.lab || '').localeCompare(b.lab || '') },
    
  ];

  return (
    <div>
      <h2>User Management</h2>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="email"
        loading={loading}
        pagination={{ pageSize: 50 }}
      />
    </div>
  );
};

export default AdminUsers;