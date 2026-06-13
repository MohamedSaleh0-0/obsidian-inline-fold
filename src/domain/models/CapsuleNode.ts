export interface CapsuleNode {
    from: number;
    to: number;
    content: string;
    classId: string;
    children: CapsuleNode[];
}