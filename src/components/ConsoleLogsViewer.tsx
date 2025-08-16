import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Terminal, RefreshCw, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  created_at: string;
  session_id: string;
  log_level: string;
  message: string;
  url?: string;
  data?: any;
}

export default function ConsoleLogsViewer() {
  const [logLevel, setLogLevel] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, error, isLoading, refetch } = useQuery({
    queryKey: ['console-logs', logLevel, selectedSession],
    queryFn: async () => {
      let query = supabase
        .from('console_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logLevel !== 'all') {
        query = query.eq('log_level', logLevel);
      }

      if (selectedSession !== 'all') {
        query = query.eq('session_id', selectedSession);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching logs:', error);
        throw error;
      }

      return data as LogEntry[];
    }
  });

  const { data: sessions } = useQuery({
    queryKey: ['console-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('console_logs')
        .select('session_id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uniqueSessions = [...new Set(data?.map(log => log.session_id) || [])];
      return uniqueSessions.slice(0, 20);
    }
  });

  const filteredLogs = logs?.filter(log => {
    if (searchTerm) {
      return log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
             log.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (log.url && log.url.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  }) || [];

  const handleExportLogs = () => {
    if (!filteredLogs.length) return;
    
    const csvContent = [
      "Timestamp,Session ID,Level,Message,URL,Data",
      ...filteredLogs.map(log => 
        `"${log.created_at}","${log.session_id}","${log.log_level}","${log.message.replace(/"/g, '""')}","${log.url || ''}","${log.data ? JSON.stringify(log.data).replace(/"/g, '""') : ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Console Logs Viewer
        </CardTitle>
        <CardDescription>
          Real-time debugging logs from Chrome extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="w-full sm:w-32">
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
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions?.map(session => (
                <SelectItem key={session} value={session}>
                  <span className="truncate">{session.substring(0, 20)}...</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => refetch()} disabled={isLoading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button onClick={handleExportLogs} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        {logs && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            <div className="text-center p-2 bg-muted/30 rounded min-w-0">
              <div className="text-base sm:text-lg font-bold">{logs.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-red-100 dark:bg-red-900/20 rounded min-w-0">
              <div className="text-base sm:text-lg font-bold text-red-600">
                {logs.filter(l => l.log_level === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
            <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded min-w-0">
              <div className="text-base sm:text-lg font-bold text-yellow-600">
                {logs.filter(l => l.log_level === 'warn').length}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/20 rounded min-w-0">
              <div className="text-base sm:text-lg font-bold text-blue-600">
                {logs.filter(l => l.log_level === 'info').length}
              </div>
              <div className="text-xs text-muted-foreground">Info</div>
            </div>
            <div className="text-center p-2 bg-gray-100 dark:bg-gray-900/20 rounded min-w-0">
              <div className="text-base sm:text-lg font-bold text-gray-600">
                {logs.filter(l => l.log_level === 'debug').length}
              </div>
              <div className="text-xs text-muted-foreground">Debug</div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500">
            <p className="text-sm">Error loading logs: {error.message}</p>
          </div>
        )}

        {logs && filteredLogs.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No logs found matching the current filters.</p>
          </div>
        )}

        {/* Log entries */}
        {logs && filteredLogs.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto w-full">
            <div className="space-y-2 p-2">
              {logs.map((log, index) => (
                <div key={`${log.id}-${index}`} className="border-b pb-2 last:border-b-0 w-full overflow-hidden">
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
                  <div className="text-sm font-mono bg-muted/30 p-2 rounded break-words overflow-wrap-anywhere w-full">
                    {log.message}
                  </div>
                  {log.data && (
                    <details className="mt-1">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Additional Data
                      </summary>
                      <pre className="text-xs mt-1 bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words w-full">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}