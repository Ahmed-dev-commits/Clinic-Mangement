import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Phone, MapPin, Calendar, Plus, ArrowLeft, History, FileText, Activity, CreditCard } from 'lucide-react';
import { patientsApi, PatientDTO } from '@/services/accessApi';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ProfileData {
    profile: PatientDTO;
    visits: PatientDTO[];
    history: {
        prescriptions: any[];
        labResults: any[];
        services: any[];
        payments: any[];
    };
}

export function PatientProfilePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const response = await patientsApi.getProfile(id);
                setData(response);
            } catch (error) {
                console.error('Failed to load profile:', error);
                toast.error('Failed to load patient profile');
                navigate('/patients');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const { profile, visits, history } = data;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            return format(new Date(dateStr), 'MMM dd, yyyy');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            {/* Header & Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{profile.Name}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-mono text-sm">MRN: {profile.MRN || profile.ID}</span>
                            <span>•</span>
                            <span>{profile.Gender}, {profile.Age} yrs</span>
                        </div>
                    </div>
                </div>
                <Button onClick={() => {
                    // Initiate new visit flow
                    // Could navigate to /patients?newVisit=true&mrn=...
                    // For now, simpler to go back to patients and search
                    // Or ideally, open the dialog directly?
                    // Let's navigate to Patients page with query param to open dialog
                    navigate(`/patients?action=new-visit&mrn=${profile.MRN || profile.ID}`);
                }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Visit
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Demographics & Visits */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{profile.Phone || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{profile.Address || 'No address'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>Registered: {formatDate(profile.CreatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex justify-between items-center">
                                <span>Visit History</span>
                                <Badge variant="secondary">{visits.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-4">
                                    {visits.map((visit) => (
                                        <div key={visit.ID} className="flex flex-col border-l-2 border-primary/20 pl-4 py-1 relative">
                                            <div className="absolute -left-[9px] top-2 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                                            <span className="text-sm font-semibold">{formatDate(visit.VisitDate)}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{visit.ID}</span>
                                            <p className="text-sm mt-1">{visit.Symptoms || 'No symptoms recorded'}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Clinical History Tabs */}
                <div className="md:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Clinical History</CardTitle>
                            <CardDescription>Consolidated records from all visits</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="prescriptions">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="prescriptions">Rx ({history.prescriptions.length})</TabsTrigger>
                                    <TabsTrigger value="labs">Labs ({history.labResults.length})</TabsTrigger>
                                    <TabsTrigger value="services">Services ({history.services.length})</TabsTrigger>
                                    <TabsTrigger value="payments">Payments ({history.payments.length})</TabsTrigger>
                                </TabsList>

                                <ScrollArea className="h-[500px] mt-4 pr-4">
                                    <TabsContent value="prescriptions" className="space-y-4">
                                        {history.prescriptions.map((px) => (
                                            <Card key={px.ID}>
                                                <CardHeader className="py-3">
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold">{formatDate(px.CreatedAt)}</span>
                                                        <Badge>{px.Diagnosis}</Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="py-2 text-sm">
                                                    {/* Parse medicines if string */}
                                                    <div className="text-muted-foreground">
                                                        {(typeof px.Medicines === 'string' ? JSON.parse(px.Medicines) : px.Medicines)?.map((m: any, i: number) => (
                                                            <div key={i}>• {m.name} - {m.dosage}</div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </TabsContent>

                                    <TabsContent value="labs" className="space-y-4">
                                        {/* Render labs similarly */}
                                        {history.labResults.map((lab) => (
                                            <Card key={lab.ID}>
                                                <CardHeader className="py-3 flex flex-row items-center justify-between">
                                                    <span className="font-semibold">{formatDate(lab.TestDate)}</span>
                                                    <Badge variant={lab.Status === 'Completed' ? 'default' : 'secondary'}>{lab.Status}</Badge>
                                                </CardHeader>
                                                <CardContent className="py-2 text-sm">
                                                    {(typeof lab.Tests === 'string' ? JSON.parse(lab.Tests) : lab.Tests)?.map((t: any, i: number) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span>{t.name}</span>
                                                            <span className={t.status === 'Critical' ? 'text-red-500' : ''}>{t.value} {t.unit}</span>
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </TabsContent>

                                    <TabsContent value="services" className="space-y-4">
                                        {history.services.map(s => (
                                            <Card key={s.ID}>
                                                <CardHeader className="py-3 flex flex-row justify-between">
                                                    <span className="font-semibold">{formatDate(s.CreatedAt)}</span>
                                                    <span className="font-bold text-primary">Rs. {s.GrandTotal}</span>
                                                </CardHeader>
                                            </Card>
                                        ))}
                                    </TabsContent>

                                    <TabsContent value="payments" className="space-y-4">
                                        {history.payments.map(p => (
                                            <Card key={p.ID}>
                                                <CardHeader className="py-3 flex flex-row justify-between">
                                                    <span className="font-semibold">{formatDate(p.CreatedAt)}</span>
                                                    <Badge variant="outline">{p.PaymentMode}</Badge>
                                                </CardHeader>
                                                <CardContent className="py-2 flex justify-between font-bold">
                                                    <span>Total Paid</span>
                                                    <span>Rs. {p.TotalAmount}</span>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </TabsContent>
                                </ScrollArea>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
