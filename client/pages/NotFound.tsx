import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-primary via-gradient-via to-gradient-to rounded-2xl flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        <div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-gradient-to bg-clip-text text-transparent mb-4">
            404
          </h1>
          <h2 className="text-2xl font-semibold mb-2">Page not found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link to="/">
          <Button className="bg-gradient-to-r from-primary to-gradient-to hover:opacity-90">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to RemoveBG Pro
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
