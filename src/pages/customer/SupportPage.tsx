/**
 * Customer Support Page
 * Help center, FAQs, and contact support
 */

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  Search,
  Droplets,
  Package,
  Wallet,
  Truck,
  Send,
  Globe,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const faqs = [
  {
    category: 'Orders',
    icon: Package,
    questions: [
      {
        q: 'How do I place an order?',
        a: 'Tap the "Place Order" button on your dashboard, select refill or new bottles, choose quantity, pick delivery time, and confirm payment.',
      },
      {
        q: 'Can I cancel my order?',
        a: 'You can cancel orders that haven\'t been assigned to a driver yet. Go to Order History, find your order, and tap Cancel.',
      },
      {
        q: 'What\'s the minimum order quantity?',
        a: 'The minimum order is 1 bottle for refills and 1 bottle for new purchases.',
      },
    ],
  },
  {
    category: 'Bottles',
    icon: Droplets,
    questions: [
      {
        q: 'What\'s the difference between refill and new bottles?',
        a: 'Refill customers own bottles and pay only for water ($3/bottle). New bottle purchases include the bottle cost ($8/bottle).',
      },
      {
        q: 'What happens to my bottle deposit?',
        a: 'Your deposit is held while you own bottles. It\'s fully refundable when you return bottles in good condition.',
      },
      {
        q: 'How many bottles can I own?',
        a: 'Customers can own between 3 and 50 refillable bottles.',
      },
    ],
  },
  {
    category: 'Payments',
    icon: Wallet,
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept Wallet balance, Cash on Delivery, and Credit Account (for approved customers).',
      },
      {
        q: 'How do I top up my wallet?',
        a: 'Go to Wallet > Add Funds, select an amount or enter custom, then complete payment via M-Pesa or card.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes, all payments are processed through secure, encrypted channels. We don\'t store your card details.',
      },
    ],
  },
  {
    category: 'Delivery',
    icon: Truck,
    questions: [
      {
        q: 'How do I track my delivery?',
        a: 'Active deliveries show on your dashboard with real-time status. You can also tap "Track Order" for live updates.',
      },
      {
        q: 'What if I\'m not home during delivery?',
        a: 'Contact your driver through the app to arrange. You can also add delivery instructions for the driver.',
      },
      {
        q: 'What are the delivery hours?',
        a: 'Standard delivery is 8 AM - 6 PM, Monday to Saturday. After-hours delivery is available for an additional fee.',
      },
    ],
  },
];

const SupportPage: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    message: '',
  });

  const handleSubmitTicket = () => {
    if (!ticketForm.subject || !ticketForm.message) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    toast({
      title: 'Ticket Submitted',
      description: 'We\'ll respond within 24 hours',
    });
    setTicketDialogOpen(false);
    setTicketForm({ subject: '', message: '' });
  };

  const filteredFaqs = searchQuery
    ? faqs.map(category => ({
        ...category,
        questions: category.questions.filter(
          q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
               q.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(category => category.questions.length > 0)
    : faqs;

  return (
    <CustomerLayout title="Help & Support">
      <div className="space-y-6 max-w-lg mx-auto">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
            <DialogTrigger asChild>
              <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-3 rounded-full bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-medium text-sm">Submit Ticket</span>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit a Support Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="What do you need help with?"
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue in detail..."
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                    rows={4}
                  />
                </div>
                <Button className="w-full" onClick={handleSubmitTicket}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <a href="tel:+254726875878">
            <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-3 rounded-full bg-success/10">
                  <Phone className="h-6 w-6 text-success" />
                </div>
                <span className="font-medium text-sm">Call Us</span>
              </div>
            </Card>
          </a>
        </div>

        {/* Contact Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">Support hours: 8 AM – 8 PM, Mon – Sat</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href="tel:+254726875878"
              className="text-sm hover:underline"
            >
              +254 726 875 878
            </a>
          </div>
          <div className="flex items-center gap-3">
            <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href="https://wa.me/254726875878"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
            >
              WhatsApp: 0726 875 878
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href="mailto:ari.gram.technologies@gmail.com"
              className="text-sm hover:underline"
            >
              ari.gram.technologies@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href="https://ari-gram-technologies.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
            >
              ari-gram-technologies.netlify.app
            </a>
          </div>
        </Card>

        {/* FAQs */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </h3>

          {filteredFaqs.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFaqs.map((category) => (
                <Card key={category.category} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <category.icon className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">{category.category}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {category.questions.length}
                    </Badge>
                  </div>
                  <Accordion type="single" collapsible>
                    {category.questions.map((faq, index) => (
                      <AccordionItem key={index} value={`${category.category}-${index}`}>
                        <AccordionTrigger className="text-left text-sm">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Still need help */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="text-center">
            <h4 className="font-medium mb-2">Still need help?</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Our support team is here for you
            </p>
            <Button variant="ocean" onClick={() => setTicketDialogOpen(true)}>
              Contact Support
            </Button>
          </div>
        </Card>

      </div>
    </CustomerLayout>
  );
};

export default SupportPage;