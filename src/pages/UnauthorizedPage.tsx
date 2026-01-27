import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-6">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        
        <Button asChild variant="ocean">
          <Link to="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
