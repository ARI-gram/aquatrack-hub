import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-gradient-ocean mb-4">404</div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button asChild variant="outline">
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Link>
          </Button>
          <Button asChild variant="ocean">
            <Link to="/" className="gap-2">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
