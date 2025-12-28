import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Alert, Button } from 'antd';

const ImpersonationBanner = () => {
  const { user, impersonator, stopImpersonating } = useContext(AuthContext);

  if (!impersonator) {
    return null;
  }

  const message = (
    <span>
      You are impersonating <strong>{user.name || user.email}</strong> (as {impersonator}).
    </span>
  );

  return (
    <Alert
      message={message}
      type="warning"
      banner
      closable={false}
      action={
        <Button size="small" type="primary" onClick={stopImpersonating}>
          Exit Impersonation
        </Button>
      }
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1050, textAlign: 'center' }}
    />
  );
};

export default ImpersonationBanner;