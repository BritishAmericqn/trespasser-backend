# 🛡️ ERROR HANDLING & BEST PRACTICES

## Overview
Comprehensive error handling for:
- Network failures
- Asset loading errors
- Physics desync
- Socket disconnections
- Runtime exceptions
- Development debugging

## Global Error Handling Architecture

### src/client/systems/ErrorHandler.ts
```typescript
export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface GameError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  context?: any;
  stack?: string;
  timestamp: number;
  recoverable: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: GameError[] = [];
  private maxErrors = 100;
  private errorCallbacks: Map<string, (error: GameError) => void> = new Map();
  private analytics?: IAnalytics;
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  private constructor() {
    this.setupGlobalHandlers();
  }
  
  private setupGlobalHandlers(): void {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handle({
        code: 'UNHANDLED_ERROR',
        message: event.message,
        severity: ErrorSeverity.ERROR,
        context: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        },
        stack: event.error?.stack,
        timestamp: Date.now(),
        recoverable: false
      });
      
      event.preventDefault();
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handle({
        code: 'UNHANDLED_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        severity: ErrorSeverity.ERROR,
        context: { reason: event.reason },
        stack: event.reason?.stack,
        timestamp: Date.now(),
        recoverable: true
      });
      
      event.preventDefault();
    });
  }
  
  handle(error: GameError): void {
    // Store error
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    // Log based on severity
    this.logError(error);
    
    // Send to analytics if available
    if (this.analytics && error.severity !== ErrorSeverity.DEBUG) {
      this.analytics.trackError(error);
    }
    
    // Execute callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
    
    // Handle fatal errors
    if (error.severity === ErrorSeverity.FATAL) {
      this.handleFatalError(error);
    }
  }
  
  private logError(error: GameError): void {
    const style = this.getLogStyle(error.severity);
    
    console.group(`%c[${error.severity.toUpperCase()}] ${error.code}`, style);
    console.log('Message:', error.message);
    
    if (error.context) {
      console.log('Context:', error.context);
    }
    
    if (error.stack) {
      console.log('Stack:', error.stack);
    }
    
    console.groupEnd();
  }
  
  private getLogStyle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.DEBUG: return 'color: #888';
      case ErrorSeverity.INFO: return 'color: #4CAF50';
      case ErrorSeverity.WARNING: return 'color: #FF9800';
      case ErrorSeverity.ERROR: return 'color: #F44336; font-weight: bold';
      case ErrorSeverity.FATAL: return 'color: #FF0000; font-weight: bold; font-size: 14px';
    }
  }
  
  private handleFatalError(error: GameError): void {
    // Show user-friendly error screen
    const errorUI = document.createElement('div');
    errorUI.className = 'fatal-error-screen';
    errorUI.innerHTML = `
      <div class="error-content">
        <h1>Oops! Something went wrong</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()">Reload Game</button>
        <details>
          <summary>Error Details</summary>
          <pre>${JSON.stringify(error, null, 2)}</pre>
        </details>
      </div>
    `;
    
    document.body.appendChild(errorUI);
  }
  
  onError(callback: (error: GameError) => void): string {
    const id = `callback_${Date.now()}`;
    this.errorCallbacks.set(id, callback);
    return id;
  }
  
  removeCallback(id: string): void {
    this.errorCallbacks.delete(id);
  }
  
  getErrors(severity?: ErrorSeverity): GameError[] {
    if (severity) {
      return this.errors.filter(e => e.severity === severity);
    }
    return [...this.errors];
  }
  
  clearErrors(): void {
    this.errors = [];
  }
}

// Convenience function
export function handleError(
  code: string,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: any,
  recoverable = true
): void {
  ErrorHandler.getInstance().handle({
    code,
    message,
    severity,
    context,
    timestamp: Date.now(),
    recoverable,
    stack: new Error().stack
  });
}
```

## Network Error Handling

### src/client/systems/NetworkErrorHandler.ts
```typescript
export class NetworkErrorHandler {
  private socket: Socket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isReconnecting = false;
  
  constructor(socket: Socket) {
    this.socket = socket;
    this.setupErrorHandlers();
  }
  
  private setupErrorHandlers(): void {
    // Connection errors
    this.socket.on('connect_error', (error) => {
      handleError(
        'SOCKET_CONNECT_ERROR',
        `Failed to connect: ${error.message}`,
        ErrorSeverity.ERROR,
        { 
          type: error.type,
          reconnectAttempts: this.reconnectAttempts 
        }
      );
      
      this.handleReconnection();
    });
    
    // Timeout
    this.socket.on('connect_timeout', () => {
      handleError(
        'SOCKET_TIMEOUT',
        'Connection timed out',
        ErrorSeverity.WARNING
      );
    });
    
    // Disconnect
    this.socket.on('disconnect', (reason) => {
      handleError(
        'SOCKET_DISCONNECT',
        `Disconnected: ${reason}`,
        ErrorSeverity.WARNING,
        { reason }
      );
      
      if (reason === 'io server disconnect') {
        // Server forced disconnect, don't reconnect
        this.handleForcedDisconnect();
      }
    });
    
    // Custom server errors
    this.socket.on('error', (error: any) => {
      handleError(
        error.code || 'SERVER_ERROR',
        error.message || 'Unknown server error',
        error.fatal ? ErrorSeverity.FATAL : ErrorSeverity.ERROR,
        error.data
      );
    });
    
    // Reconnection success
    this.socket.on('reconnect', (attemptNumber) => {
      handleError(
        'SOCKET_RECONNECTED',
        `Reconnected after ${attemptNumber} attempts`,
        ErrorSeverity.INFO
      );
      
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    });
  }
  
  private handleReconnection(): void {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      handleError(
        'SOCKET_RECONNECT_FAILED',
        'Failed to reconnect after maximum attempts',
        ErrorSeverity.FATAL
      );
      return;
    }
    
    // Exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    setTimeout(() => {
      this.socket.connect();
    }, delay);
  }
  
  private handleForcedDisconnect(): void {
    // Show message to user
    const ui = GameUI.getInstance();
    ui.showNotification({
      type: 'error',
      title: 'Disconnected from server',
      message: 'You have been disconnected. Please refresh to rejoin.',
      persistent: true
    });
  }
}
```

## Asset Loading Error Handling

### Enhanced Asset Loader with Error Handling
```typescript
export class RobustAssetLoader extends AssetLoader {
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;
  private fallbackAssets: Map<string, string> = new Map([
    ['player-sprite', 'assets/fallback/player.png'],
    ['wall-texture', 'assets/fallback/wall.png']
  ]);
  
  protected async loadAssetGroup(groupName: string, assets: AssetGroup[]): Promise<void> {
    const failedAssets: AssetGroup[] = [];
    
    for (const asset of assets) {
      try {
        await this.loadSingleAsset(asset);
      } catch (error) {
        failedAssets.push(asset);
        
        handleError(
          'ASSET_LOAD_FAILED',
          `Failed to load asset: ${asset.key}`,
          ErrorSeverity.WARNING,
          { asset, error: error.message }
        );
      }
    }
    
    // Retry failed assets
    if (failedAssets.length > 0) {
      await this.retryFailedAssets(failedAssets);
    }
  }
  
  private async retryFailedAssets(assets: AssetGroup[]): Promise<void> {
    for (const asset of assets) {
      const attempts = this.retryAttempts.get(asset.key) || 0;
      
      if (attempts < this.maxRetries) {
        this.retryAttempts.set(asset.key, attempts + 1);
        
        try {
          // Add retry delay
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));
          await this.loadSingleAsset(asset);
          
          handleError(
            'ASSET_RETRY_SUCCESS',
            `Successfully loaded asset on retry: ${asset.key}`,
            ErrorSeverity.INFO
          );
        } catch (error) {
          // Try fallback asset
          await this.loadFallbackAsset(asset);
        }
      } else {
        // Final fallback
        await this.loadFallbackAsset(asset);
      }
    }
  }
  
  private async loadFallbackAsset(asset: AssetGroup): Promise<void> {
    const fallbackUrl = this.fallbackAssets.get(asset.key);
    
    if (fallbackUrl) {
      try {
        const fallbackAsset = { ...asset, url: fallbackUrl };
        await this.loadSingleAsset(fallbackAsset);
        
        handleError(
          'ASSET_FALLBACK_LOADED',
          `Loaded fallback asset for: ${asset.key}`,
          ErrorSeverity.WARNING
        );
      } catch (error) {
        handleError(
          'ASSET_FALLBACK_FAILED',
          `Failed to load fallback asset: ${asset.key}`,
          ErrorSeverity.ERROR,
          { asset, error: error.message },
          false
        );
      }
    }
  }
}
```

## Development Debugging Tools

### src/client/debug/DebugPanel.ts
```typescript
export class DebugPanel {
  private container: HTMLDivElement;
  private stats: Stats; // three.js stats
  private panels: Map<string, DebugPanelSection> = new Map();
  private visible = false;
  
  constructor() {
    this.createUI();
    this.setupKeyBindings();
    this.initializeStats();
  }
  
  private createUI(): void {
    this.container = document.createElement('div');
    this.container.className = 'debug-panel';
    this.container.innerHTML = `
      <div class="debug-header">
        <h3>Debug Panel</h3>
        <button class="debug-close">×</button>
      </div>
      <div class="debug-content">
        <div class="debug-tabs">
          <button data-tab="performance" class="active">Performance</button>
          <button data-tab="network">Network</button>
          <button data-tab="physics">Physics</button>
          <button data-tab="errors">Errors</button>
        </div>
        <div class="debug-panels"></div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    this.setupEventListeners();
  }
  
  private setupKeyBindings(): void {
    document.addEventListener('keydown', (e) => {
      // Toggle with F3
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
      
      // Quick commands
      if (this.visible && e.ctrlKey) {
        switch (e.key) {
          case 'c': // Clear console
            console.clear();
            break;
          case 'e': // Export error log
            this.exportErrorLog();
            break;
          case 'p': // Take performance snapshot
            this.takePerformanceSnapshot();
            break;
        }
      }
    });
  }
  
  addPanel(name: string, panel: DebugPanelSection): void {
    this.panels.set(name, panel);
    panel.attach(this.container.querySelector('.debug-panels'));
  }
  
  private initializeStats(): void {
    this.stats = new Stats();
    this.stats.showPanel(0); // FPS
    this.container.appendChild(this.stats.dom);
  }
  
  update(): void {
    if (!this.visible) return;
    
    this.stats.update();
    
    // Update all panels
    this.panels.forEach(panel => panel.update());
  }
  
  private takePerformanceSnapshot(): void {
    const snapshot = {
      timestamp: new Date().toISOString(),
      memory: (performance as any).memory,
      timing: performance.timing,
      fps: this.stats.getFPS(),
      errors: ErrorHandler.getInstance().getErrors()
    };
    
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-snapshot-${Date.now()}.json`;
    a.click();
    
    handleError(
      'DEBUG_SNAPSHOT',
      'Performance snapshot saved',
      ErrorSeverity.INFO
    );
  }
  
  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }
}

// Network Debug Panel
export class NetworkDebugPanel extends DebugPanelSection {
  private latency = 0;
  private packetsIn = 0;
  private packetsOut = 0;
  private bandwidth = 0;
  
  render(): string {
    return `
      <div class="debug-network">
        <div class="stat">
          <label>Latency:</label>
          <span class="${this.getLatencyClass()}">${this.latency}ms</span>
        </div>
        <div class="stat">
          <label>Packets In/Out:</label>
          <span>${this.packetsIn}/${this.packetsOut}</span>
        </div>
        <div class="stat">
          <label>Bandwidth:</label>
          <span>${this.formatBytes(this.bandwidth)}/s</span>
        </div>
        <div class="actions">
          <button onclick="debugPanel.simulateLatency()">Simulate Latency</button>
          <button onclick="debugPanel.dropPackets()">Drop Packets</button>
        </div>
      </div>
    `;
  }
  
  private getLatencyClass(): string {
    if (this.latency < 50) return 'good';
    if (this.latency < 150) return 'warning';
    return 'bad';
  }
}
```

## Best Practices for AI-First Development

### 1. **Self-Documenting Code**
```typescript
/**
 * Handles wall destruction at the specified position.
 * 
 * @param wall - The wall entity to damage
 * @param position - World position of the damage
 * @param damage - Amount of damage to apply
 * @param type - Type of damage (bullet, explosive)
 * @returns The updated wall state after damage
 * 
 * @example
 * const updatedWall = damageWall(wall, {x: 100, y: 200}, 50, 'bullet');
 * 
 * @throws {InvalidWallError} If wall is not destructible
 * @throws {InvalidDamageError} If damage parameters are invalid
 */
export function damageWall(
  wall: DestructibleWall,
  position: Vector2,
  damage: number,
  type: DamageType
): WallState {
  // Validate inputs with clear error messages
  if (!wall.destructible) {
    throw new InvalidWallError(
      `Wall ${wall.id} is not destructible`,
      { wall, position, damage, type }
    );
  }
  
  if (damage < 0 || damage > MAX_DAMAGE) {
    throw new InvalidDamageError(
      `Damage must be between 0 and ${MAX_DAMAGE}`,
      { provided: damage }
    );
  }
  
  // Implementation with inline comments
  const damageRadius = calculateDamageRadius(damage, type);
  const affectedSlices = wall.getSlicesInRadius(position, damageRadius);
  
  // Apply damage with clear state transitions
  affectedSlices.forEach(slice => {
    const oldHealth = slice.health;
    slice.applyDamage(damage * getDamageMultiplier(type, wall.material));
    
    // Log state change for debugging
    if (DEBUG) {
      console.log(`Slice ${slice.id}: ${oldHealth} -> ${slice.health}`);
    }
  });
  
  return wall.getState();
}
```

### 2. **Error Boundaries**
```typescript
export class ErrorBoundary {
  static async wrap<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      handleError(
        'OPERATION_FAILED',
        `${context} failed: ${error.message}`,
        ErrorSeverity.ERROR,
        { error, context },
        true
      );
      
      if (fallback !== undefined) {
        return fallback;
      }
      
      throw error;
    }
  }
  
  static wrapSync<T>(
    operation: () => T,
    context: string,
    fallback?: T
  ): T {
    try {
      return operation();
    } catch (error) {
      handleError(
        'OPERATION_FAILED',
        `${context} failed: ${error.message}`,
        ErrorSeverity.ERROR,
        { error, context },
        true
      );
      
      if (fallback !== undefined) {
        return fallback;
      }
      
      throw error;
    }
  }
}

// Usage
const result = await ErrorBoundary.wrap(
  async () => await loadAsset('player-sprite'),
  'Loading player sprite',
  defaultSprite
);
```

### 3. **Validation Helpers**
```typescript
export class Validator {
  static assertDefined<T>(
    value: T | null | undefined,
    name: string
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new ValidationError(`${name} is required but was ${value}`);
    }
  }
  
  static assertInRange(
    value: number,
    min: number,
    max: number,
    name: string
  ): void {
    if (value < min || value > max) {
      throw new ValidationError(
        `${name} must be between ${min} and ${max}, got ${value}`
      );
    }
  }
  
  static assertEnum<T>(
    value: any,
    enumObj: object,
    name: string
  ): asserts value is T {
    if (!Object.values(enumObj).includes(value)) {
      throw new ValidationError(
        `${name} must be one of ${Object.values(enumObj).join(', ')}, got ${value}`
      );
    }
  }
}
```

## Monitoring & Analytics

### src/client/systems/Analytics.ts
```typescript
export class GameAnalytics implements IAnalytics {
  private queue: AnalyticsEvent[] = [];
  private flushInterval = 30000; // 30 seconds
  
  trackError(error: GameError): void {
    this.track('error', {
      code: error.code,
      severity: error.severity,
      message: error.message,
      context: error.context
    });
  }
  
  trackPerformance(metrics: PerformanceMetrics): void {
    this.track('performance', {
      fps: metrics.fps,
      latency: metrics.latency,
      memoryUsage: metrics.memoryUsage,
      drawCalls: metrics.drawCalls
    });
  }
  
  trackGameEvent(event: string, data?: any): void {
    this.track('game_event', {
      event,
      data
    });
  }
  
  private track(type: string, data: any): void {
    this.queue.push({
      type,
      data,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getUserId()
    });
    
    if (this.queue.length >= 50) {
      this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      // Re-queue events on failure
      this.queue.unshift(...events);
    }
  }
}
```

This comprehensive error handling system provides:
- ✅ Global error catching and logging
- ✅ Network error recovery
- ✅ Asset loading fallbacks
- ✅ Development debugging tools
- ✅ Self-documenting code patterns
- ✅ Analytics and monitoring integration 