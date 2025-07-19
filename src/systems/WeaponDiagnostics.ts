import { WeaponState, PlayerState } from '../../shared/types';

export class WeaponDiagnostics {
  private static enabled = true;
  
  static logWeaponFire(weapon: WeaponState, player: PlayerState, canFire: boolean, error?: string) {
    if (!this.enabled) return;
    
    console.log(`\n🔫 [WEAPON FIRE] ${weapon.type} by ${player.id.substring(0, 8)}`);
    console.log(`   Ammo: ${weapon.currentAmmo}/${weapon.maxAmmo} (Reserve: ${weapon.reserveAmmo})`);
    console.log(`   Can Fire: ${canFire ? '✅' : '❌'} ${error ? `- ${error}` : ''}`);
    console.log(`   Is Reloading: ${weapon.isReloading}`);
    console.log(`   Player Weapon ID: ${player.weaponId}`);
    console.log(`   Available Weapons: [${Array.from(player.weapons.keys()).join(', ')}]`);
  }
  
  static logWeaponReload(weapon: WeaponState, player: PlayerState, canReload: boolean, error?: string) {
    if (!this.enabled) return;
    
    console.log(`\n🔄 [WEAPON RELOAD] ${weapon.type} by ${player.id.substring(0, 8)}`);
    console.log(`   Ammo: ${weapon.currentAmmo}/${weapon.maxAmmo} (Reserve: ${weapon.reserveAmmo})`);
    console.log(`   Can Reload: ${canReload ? '✅' : '❌'} ${error ? `- ${error}` : ''}`);
  }
  
  static logWeaponSwitch(from: string, to: string, player: PlayerState, canSwitch: boolean, error?: string) {
    if (!this.enabled) return;
    
    console.log(`\n🔀 [WEAPON SWITCH] ${from} → ${to} by ${player.id.substring(0, 8)}`);
    console.log(`   Can Switch: ${canSwitch ? '✅' : '❌'} ${error ? `- ${error}` : ''}`);
    console.log(`   Available: [${Array.from(player.weapons.keys()).join(', ')}]`);
  }
  
  static logProjectileCreation(type: string, id: string, position: any, velocity: any) {
    if (!this.enabled) return;
    
    console.log(`\n🚀 [PROJECTILE CREATED] ${type}`);
    console.log(`   ID: ${id}`);
    console.log(`   Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    console.log(`   Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)})`);
  }
  
  static logEventSent(eventType: string, data: any) {
    if (!this.enabled) return;
    
    console.log(`\n📤 [EVENT SENT] ${eventType}`);
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
  
  static logError(context: string, error: any) {
    console.error(`\n❌ [ERROR] ${context}:`, error);
  }
  
  static logWeaponState(player: PlayerState) {
    if (!this.enabled) return;
    
    console.log(`\n📊 [WEAPON STATE] Player ${player.id.substring(0, 8)}`);
    console.log(`   Current Weapon: ${player.weaponId}`);
    console.log(`   Weapons:`);
    for (const [type, weapon] of player.weapons) {
      console.log(`     - ${type}: ${weapon.currentAmmo}/${weapon.maxAmmo} (Reserve: ${weapon.reserveAmmo})`);
    }
  }
} 