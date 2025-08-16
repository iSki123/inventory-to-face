import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Download, Filter, Search, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function ConsoleLogsViewer() {
  const [logLevel, setLogLevel] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<string>("all");

  // Fetch console logs
  const { data: logs, refetch, isLoading } = useQuery({
    queryKey: ['console-logs', logLevel, searchTerm, selectedSession],
    queryFn: async () => {
      let query = supabase
        .from('console_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logLevel !== "all") {
        query = query.eq('log_level', logLevel);
      }

      if (selectedSession !== "all") {
        query = query.eq('session_id', selectedSession);
      }

      if (searchTerm) {
        query = query.or(`message.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Auto-refresh every 10 seconds
  });

  // Fetch unique sessions
  const { data: sessions } = useQuery({
    queryKey: ['console-log-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('console_logs')
        .select('session_id')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const uniqueSessions = [...new Set(data.map(log => log.session_id))];
      return uniqueSessions.slice(0, 20); // Last 20 sessions
    }
  });

  const handleExportLogs = () => {
    if (!logs || logs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const csvContent = [
      "Timestamp,Level,Session,URL,Message,Data",
      ...logs.map(log => [
        log.created_at,
        log.log_level,
        log.session_id,
        log.url || '',
        `"${log.message.replace(/"/g, '""')}"`,
        log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Logs exported successfully");
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': return 'default';
      case 'debug': return 'outline';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Console Logs Viewer
        </CardTitle>
        <CardDescription>
          Real-time debugging logs from Chrome extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Log Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="log">Log</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-40 sm:w-48">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions?.map(session => (
                <SelectItem key={session} value={session}>
                  {session.substring(0, 20)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <Button onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button onClick={handleExportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Stats */}
        {logs && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="text-lg font-bold">{logs.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-red-100 dark:bg-red-900/20 rounded">
              <div className="text-lg font-bold text-red-600">
                {logs.filter(l => l.log_level === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
            <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
              <div className="text-lg font-bold text-yellow-600">
                {logs.filter(l => l.log_level === 'warn').length}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
              <div className="text-lg font-bold text-blue-600">
                {logs.filter(l => l.log_level === 'info').length}
              </div>
              <div className="text-xs text-muted-foreground">Info</div>
            </div>
            <div className="text-center p-2 bg-gray-100 dark:bg-gray-900/20 rounded">
              <div className="text-lg font-bold text-gray-600">
                {logs.filter(l => l.log_level === 'debug').length}
              </div>
              <div className="text-xs text-muted-foreground">Debug</div>
            </div>
          </div>
        )}

        {/* Logs Display */}
        <div className="border rounded-lg max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading logs...
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No logs found matching your criteria
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {logs.map((log, index) => (
                <div key={`${log.id}-${index}`} className="border-b pb-2 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={getLogLevelColor(log.log_level)}>
                      {log.log_level.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-20 sm:max-w-32">
                      {log.session_id}
                    </span>
                    {log.url && (
                      <span className="text-xs text-blue-600 truncate max-w-24 sm:max-w-48">
                        {new URL(log.url).pathname}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-mono bg-muted/30 p-2 rounded break-words overflow-wrap-anywhere">
                    {log.message}
                  </div>
                  {log.data && (
                    <details className="mt-1">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Additional Data
                      </summary>
                      <pre className="text-xs mt-1 bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}