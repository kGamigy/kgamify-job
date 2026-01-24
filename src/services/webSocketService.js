import { io } from 'socket.io-client';
import store from '../store';
import { getWsUrl } from '../utils/apiUrl';
import { 
  addNotification, 
  updateNotification, 
  removeNotification,
  setConnectionStatus 
} from '../store/slices/notificationsSlice';
import { 
  addNewJob, 
  updateJobInList, 
  removeJob 
} from '../store/slices/jobsSlice';
import { 
  updateApplicationStatus,
  addApplication,
  updateApplication 
} from '../store/slices/applicationsSlice';
import { updateUser } from '../store/slices/authSlice';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.listeners = new Map();
    this.heartbeatInterval = null;
    this.connectionPromise = null;
  }

  // Initialize connection
  async connect(token) {
    if (this.isConnecting || (this.socket && this.socket.connected)) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;
    
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const serverUrl = getWsUrl();

        this.socket = io(serverUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          timeout: 20000,
          retries: 3,
          forceNew: true,
          autoConnect: true
        });

        this.setupEventListeners();
        
        this.socket.on('connect', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          store.dispatch(setConnectionStatus(true));
          this.startHeartbeat();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          this.isConnecting = false;
          store.dispatch(setConnectionStatus(false));
          this.handleReconnect();
          reject(error);
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  // Setup event listeners for real-time updates
  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      store.dispatch(setConnectionStatus(false));
      this.stopHeartbeat();
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('reconnect', () => {
      store.dispatch(setConnectionStatus(true));
      this.startHeartbeat();
    });

    // Notification events
    this.socket.on('notification:new', (notification) => {
      store.dispatch(addNotification(notification));
    });

    this.socket.on('notification:update', (notification) => {
      store.dispatch(updateNotification(notification));
    });

    this.socket.on('notification:delete', (notificationId) => {
      store.dispatch(removeNotification(notificationId));
    });

    // Job events
    this.socket.on('job:new', (job) => {
      store.dispatch(addNewJob(job));
    });

    this.socket.on('job:update', (job) => {
      store.dispatch(updateJobInList(job));
    });

    this.socket.on('job:delete', (jobId) => {
      store.dispatch(removeJob(jobId));
    });

    // Application events
    this.socket.on('application:new', (application) => {
      store.dispatch(addApplication(application));
    });

    this.socket.on('application:update', (application) => {
      store.dispatch(updateApplication(application));
    });

    this.socket.on('application:status_change', ({ applicationId, status, updatedAt }) => {
      store.dispatch(updateApplicationStatus({ 
        applicationId, 
        status, 
        updatedAt 
      }));
    });

    // User events
    this.socket.on('user:update', (userData) => {
      store.dispatch(updateUser(userData));
    });

    // System events
    this.socket.on('system:maintenance', (data) => {
      store.dispatch(addNotification({
        type: 'system',
        title: 'System Maintenance',
        message: data.message,
        priority: 'high',
        timestamp: new Date().toISOString()
      }));
    });

    this.socket.on('system:broadcast', (data) => {
      store.dispatch(addNotification({
        type: 'system',
        title: data.title,
        message: data.message,
        priority: data.priority || 'normal',
        timestamp: new Date().toISOString()
      }));
    });

    // Error handling
    this.socket.on('error', () => {
      // Log error to service or dispatch error action
      store.dispatch(addNotification({
        type: 'system',
        title: 'Connection Error',
        message: 'WebSocket connection error occurred',
        priority: 'low',
        timestamp: new Date().toISOString()
      }));
    });
  }

  // Handle reconnection with exponential backoff
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  // Heartbeat to keep connection alive
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    store.dispatch(setConnectionStatus(false));
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
  }

  // Check connection status
  isConnected() {
    return this.socket && this.socket.connected;
  }

  // Join room (for targeted updates)
  joinRoom(room) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', room);
    }
  }

  // Leave room
  leaveRoom(room) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave', room);
    }
  }

  // Send message
  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  // Add custom event listener
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // Store for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  // Remove custom event listener
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      
      // Remove from stored listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }

  // Subscribe to job updates for specific user
  subscribeToJobUpdates(userId) {
    this.joinRoom(`user:${userId}:jobs`);
  }

  // Subscribe to application updates for specific user
  subscribeToApplicationUpdates(userId) {
    this.joinRoom(`user:${userId}:applications`);
  }

  // Subscribe to notifications for specific user
  subscribeToNotifications(userId) {
    this.joinRoom(`user:${userId}:notifications`);
  }

  // Subscribe to company updates for specific company
  subscribeToCompanyUpdates(companyId) {
    this.joinRoom(`company:${companyId}`);
  }

  // Subscribe to job-specific updates (for job details page)
  subscribeToJobDetails(jobId) {
    this.joinRoom(`job:${jobId}`);
  }

  // Unsubscribe from updates
  unsubscribeFromJobUpdates(userId) {
    this.leaveRoom(`user:${userId}:jobs`);
  }

  unsubscribeFromApplicationUpdates(userId) {
    this.leaveRoom(`user:${userId}:applications`);
  }

  unsubscribeFromNotifications(userId) {
    this.leaveRoom(`user:${userId}:notifications`);
  }

  unsubscribeFromCompanyUpdates(companyId) {
    this.leaveRoom(`company:${companyId}`);
  }

  unsubscribeFromJobDetails(jobId) {
    this.leaveRoom(`job:${jobId}`);
  }

  // Get connection info
  getConnectionInfo() {
    if (!this.socket) {
      return {
        connected: false,
        id: null,
        transport: null
      };
    }

    return {
      connected: this.socket.connected,
      id: this.socket.id,
      transport: this.socket.io.engine?.transport?.name,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Send typing indicator (for chat features)
  sendTyping(room, isTyping) {
    this.emit('typing', { room, isTyping });
  }

  // Send read receipt
  sendReadReceipt(notificationId) {
    this.emit('notification:read', { notificationId });
  }

  // Send presence update
  updatePresence(status) {
    this.emit('presence:update', { status, timestamp: Date.now() });
  }

  // Batch operations for efficiency
  batchEmit(events) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('batch', events);
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Auto-connect when user is authenticated
const initializeWebSocket = () => {
  const token = localStorage.getItem('token');
  const user = store.getState().auth.user;
  
  if (token && user && !webSocketService.isConnected()) {
    webSocketService.connect(token).then(() => {
      // Subscribe to user-specific updates
      webSocketService.subscribeToNotifications(user._id);
      webSocketService.subscribeToApplicationUpdates(user._id);
      webSocketService.subscribeToJobUpdates(user._id);
    }).catch(() => {
      // Handle connection error silently
    });
  }
};

// Auto-disconnect when user logs out
const cleanupWebSocket = () => {
  if (webSocketService.isConnected()) {
    webSocketService.disconnect();
  }
};

// Listen for auth state changes
let currentAuthState = null;
store.subscribe(() => {
  const authState = store.getState().auth;
  
  if (authState.isAuthenticated && !currentAuthState?.isAuthenticated) {
    // User just logged in
    initializeWebSocket();
  } else if (!authState.isAuthenticated && currentAuthState?.isAuthenticated) {
    // User just logged out
    cleanupWebSocket();
  }
  
  currentAuthState = authState;
});

export default webSocketService;
export { initializeWebSocket, cleanupWebSocket };
