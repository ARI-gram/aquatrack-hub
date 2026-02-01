/**
 * Customer Addresses Page
 * Manage delivery addresses
 */

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Home,
  Building,
  Star,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Address {
  id: string;
  label: string;
  address: string;
  instructions?: string;
  isDefault: boolean;
  type: 'home' | 'work' | 'other';
}

const AddressesPage: React.FC = () => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      label: 'Home',
      address: '123 Main Street, Apt 4B, Westlands, Nairobi',
      instructions: 'Ring the doorbell twice',
      isDefault: true,
      type: 'home',
    },
    {
      id: '2',
      label: 'Office',
      address: 'ABC Business Center, Floor 5, Upperhill, Nairobi',
      instructions: 'Ask for reception',
      isDefault: false,
      type: 'work',
    },
  ]);

  const [formData, setFormData] = useState({
    label: '',
    address: '',
    instructions: '',
    type: 'home' as 'home' | 'work' | 'other',
  });

  const handleOpenDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        label: address.label,
        address: address.address,
        instructions: address.instructions || '',
        type: address.type,
      });
    } else {
      setEditingAddress(null);
      setFormData({ label: '', address: '', instructions: '', type: 'home' });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.label || !formData.address) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    if (editingAddress) {
      setAddresses(addresses.map(a => 
        a.id === editingAddress.id 
          ? { ...a, ...formData }
          : a
      ));
      toast({ title: 'Address updated successfully' });
    } else {
      const newAddress: Address = {
        id: Date.now().toString(),
        ...formData,
        isDefault: addresses.length === 0,
      };
      setAddresses([...addresses, newAddress]);
      toast({ title: 'Address added successfully' });
    }
    
    setDialogOpen(false);
  };

  const handleSetDefault = (id: string) => {
    setAddresses(addresses.map(a => ({
      ...a,
      isDefault: a.id === id,
    })));
    toast({ title: 'Default address updated' });
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
    toast({ title: 'Address removed' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'home': return Home;
      case 'work': return Building;
      default: return MapPin;
    }
  };

  return (
    <CustomerLayout title="My Addresses">
      <div className="space-y-4 max-w-lg mx-auto">
        {/* Add Address Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full h-14" onClick={() => handleOpenDialog()}>
              <Plus className="h-5 w-5 mr-2" />
              Add New Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Address Type</Label>
                <div className="flex gap-2">
                  {(['home', 'work', 'other'] as const).map((type) => {
                    const Icon = getTypeIcon(type);
                    return (
                      <Button
                        key={type}
                        variant={formData.type === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData({ ...formData, type })}
                        className="flex-1"
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="e.g., Home, Mom's House"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Full Address *</Label>
                <Textarea
                  id="address"
                  placeholder="Enter your complete address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Delivery Instructions (optional)</Label>
                <Textarea
                  id="instructions"
                  placeholder="e.g., Ring the doorbell, leave at gate..."
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={2}
                />
              </div>

              <Button className="w-full" onClick={handleSave}>
                {editingAddress ? 'Update Address' : 'Add Address'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Address List */}
        {addresses.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No addresses yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first delivery address to get started
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => {
              const Icon = getTypeIcon(address.type);
              return (
                <Card key={address.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{address.label}</span>
                        {address.isDefault && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Star className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {address.address}
                      </p>
                      {address.instructions && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          📝 {address.instructions}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(address)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!address.isDefault && (
                          <DropdownMenuItem onClick={() => handleSetDefault(address.id)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(address.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

export default AddressesPage;
